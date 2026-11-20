use crate::vault::{self, VaultKey};
use oxigraph::io::{RdfFormat, RdfParser};
use oxigraph::model::{GraphName, GraphNameRef, Literal, NamedNode, Quad, SubjectRef};
use oxigraph::sparql::QueryResults;
use oxigraph::store::Store;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

const BASE_IRI: &str = "https://citadel.local/ontology/";
const RDF_TYPE: &str = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const ENTRY: &str = "https://citadel.local/ontology/entry";
const CONCEPT: &str = "https://citadel.local/ontology/concept";
const MENTIONS: &str = "https://citadel.local/ontology/mentions";
const DAY: &str = "https://citadel.local/ontology/day";
const CREATED_AT: &str = "https://citadel.local/ontology/createdAt";
const UPDATED_AT: &str = "https://citadel.local/ontology/updatedAt";
const TAG: &str = "https://citadel.local/ontology/tag";
const TEXT: &str = "https://citadel.local/ontology/text";

pub struct GraphState {
    path: PathBuf,
    legacy_dir: PathBuf,
    key: VaultKey,
    store: Mutex<Store>,
}

const GRAPH_AAD: &[u8] = b"citadel-graph-snapshot-v1";

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GraphEntryInput {
    pub id: String,
    pub day: String,
    pub created_at: String,
    pub updated_at: String,
    pub text: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub concepts: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GraphQueryResult {
    pub kind: String,
    pub variables: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub boolean: Option<bool>,
}

pub fn open(path: &Path, key: &VaultKey) -> Result<GraphState, String> {
    let legacy_dir = path.to_path_buf();
    let snapshot_path = path.with_extension("enc");
    let store = Store::new().map_err(|error| format!("Cannot create in-memory graph: {error}"))?;
    if snapshot_path.exists() {
        let (bytes, was_legacy) = vault::read_encrypted_or_legacy(&snapshot_path, key, GRAPH_AAD)?;
        store
            .load_from_reader(
                RdfParser::from_format(RdfFormat::NTriples),
                Cursor::new(bytes),
            )
            .map_err(|error| format!("Cannot load encrypted graph snapshot: {error}"))?;
        if was_legacy {
            persist_graph(&store, &snapshot_path, key)?;
        }
        // A prior interrupted migration may have left the plaintext RocksDB
        // projection beside its encrypted snapshot; remove and verify it.
        vault::remove_and_verify(&legacy_dir)?;
    } else if legacy_dir.exists() {
        // One-time conversion of the previous RocksDB graph into an encrypted N-Triples snapshot.
        let old = Store::open(&legacy_dir)
            .map_err(|error| format!("Cannot open legacy graph store: {error}"))?;
        let mut bytes = Vec::new();
        old.dump_graph_to_writer(GraphNameRef::DefaultGraph, RdfFormat::NTriples, &mut bytes)
            .map_err(|error| format!("Cannot export legacy graph: {error}"))?;
        store
            .load_from_reader(
                RdfParser::from_format(RdfFormat::NTriples),
                Cursor::new(bytes),
            )
            .map_err(|error| format!("Cannot import legacy graph: {error}"))?;
        persist_graph(&store, &snapshot_path, key)?;
        vault::remove_and_verify(&legacy_dir)?;
    }
    Ok(GraphState {
        path: snapshot_path,
        legacy_dir,
        key: key.clone(),
        store: Mutex::new(store),
    })
}

fn persist_graph(store: &Store, path: &Path, key: &VaultKey) -> Result<(), String> {
    let mut bytes = Vec::new();
    store
        .dump_graph_to_writer(GraphNameRef::DefaultGraph, RdfFormat::NTriples, &mut bytes)
        .map_err(|error| format!("Cannot serialize graph snapshot: {error}"))?;
    vault::write_encrypted(path, &bytes, key, GRAPH_AAD)
}

fn iri(value: &str) -> Result<NamedNode, String> {
    NamedNode::new(value).map_err(|err| format!("Invalid graph IRI: {err}"))
}

fn entry_subject(id: &str) -> Result<NamedNode, String> {
    iri(&format!("{BASE_IRI}entry/{id}"))
}

fn concept_subject(concept: &str) -> Result<NamedNode, String> {
    iri(&format!("{BASE_IRI}concept/{}", url_escape(concept)))
}

fn url_escape(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn literal(value: &str) -> Literal {
    Literal::new_simple_literal(value)
}

fn retract_subject(store: &Store, subject: &NamedNode) -> Result<(), String> {
    let quads = store
        .quads_for_pattern(
            Some(SubjectRef::NamedNode(subject.as_ref())),
            None,
            None,
            None,
        )
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("Failed to find entry triples: {err}"))?;
    for quad in quads {
        store
            .remove(&quad)
            .map_err(|err| format!("Failed to retract entry triple: {err}"))?;
    }
    Ok(())
}

fn assert_entry(store: &Store, entry: &GraphEntryInput) -> Result<(), String> {
    let subject = entry_subject(&entry.id)?;
    let rdf_type = iri(RDF_TYPE)?;
    let entry_type = iri(ENTRY)?;
    let mentions = iri(MENTIONS)?;
    let day = iri(DAY)?;
    let created_at = iri(CREATED_AT)?;
    let updated_at = iri(UPDATED_AT)?;
    let tag = iri(TAG)?;
    let text = iri(TEXT)?;

    retract_subject(store, &subject)?;
    store
        .insert(&Quad::new(
            subject.clone(),
            rdf_type.clone(),
            entry_type,
            GraphName::DefaultGraph,
        ))
        .map_err(|err| format!("Failed to assert entry type: {err}"))?;

    for (predicate, value) in [
        (day, entry.day.as_str()),
        (created_at, entry.created_at.as_str()),
        (updated_at, entry.updated_at.as_str()),
        (text, entry.text.as_str()),
    ] {
        store
            .insert(&Quad::new(
                subject.clone(),
                predicate,
                literal(value),
                GraphName::DefaultGraph,
            ))
            .map_err(|err| format!("Failed to assert entry metadata: {err}"))?;
    }
    for value in &entry.tags {
        store
            .insert(&Quad::new(
                subject.clone(),
                tag.clone(),
                literal(value),
                GraphName::DefaultGraph,
            ))
            .map_err(|err| format!("Failed to assert entry tag: {err}"))?;
    }
    for value in &entry.concepts {
        store
            .insert(&Quad::new(
                subject.clone(),
                mentions.clone(),
                concept_subject(value)?,
                GraphName::DefaultGraph,
            ))
            .map_err(|err| format!("Failed to assert entry concept: {err}"))?;
        let concept = concept_subject(value)?;
        store
            .insert(&Quad::new(
                concept,
                rdf_type.clone(),
                iri(CONCEPT)?,
                GraphName::DefaultGraph,
            ))
            .map_err(|err| format!("Failed to assert concept: {err}"))?;
    }
    Ok(())
}

/// Apply one verified journal entry to the rebuildable RDF projection.
pub fn project_entry(state: &GraphState, entry: &GraphEntryInput) -> Result<(), String> {
    let store = state
        .store
        .lock()
        .map_err(|_| "Graph store lock poisoned".to_string())?;
    assert_entry(&store, entry).and_then(|()| persist_graph(&store, &state.path, &state.key))
}

#[tauri::command]
pub fn graph_query(
    runtime: State<'_, crate::VaultRuntime>,
    query: String,
) -> Result<GraphQueryResult, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let state = &services.graph;
    let store = state
        .store
        .lock()
        .map_err(|_| "Graph store lock poisoned".to_string())?;
    match store
        .query(query.as_str())
        .map_err(|err| format!("SPARQL query failed: {err}"))?
    {
        QueryResults::Solutions(solutions) => {
            let variables = solutions
                .variables()
                .iter()
                .map(|v| v.as_str().to_string())
                .collect::<Vec<_>>();
            let mut rows = Vec::new();
            for solution in solutions {
                let solution = solution.map_err(|err| format!("SPARQL row failed: {err}"))?;
                rows.push(
                    variables
                        .iter()
                        .map(|variable| {
                            solution
                                .get(variable.as_str())
                                .map(ToString::to_string)
                                .unwrap_or_default()
                        })
                        .collect(),
                );
            }
            Ok(GraphQueryResult {
                kind: "solutions".to_string(),
                variables,
                rows,
                boolean: None,
            })
        }
        QueryResults::Boolean(value) => Ok(GraphQueryResult {
            kind: "boolean".to_string(),
            variables: Vec::new(),
            rows: Vec::new(),
            boolean: Some(value),
        }),
        QueryResults::Graph(_) => {
            Err("Graph query results are not supported by this command".to_string())
        }
    }
}

/// Rebuild the projection solely from verified journal events.
pub fn rebuild_projection(state: &GraphState, entries: &[GraphEntryInput]) -> Result<(), String> {
    let store = state
        .store
        .lock()
        .map_err(|_| "Graph store lock poisoned".to_string())?;
    store
        .clear()
        .map_err(|err| format!("Failed to clear graph: {err}"))?;
    for entry in entries {
        assert_entry(&store, entry)?;
    }
    persist_graph(&store, &state.path, &state.key)
}

/// Wipe the in-memory projection and its encrypted snapshot.
pub fn clear_graph(state: &GraphState) -> Result<(), String> {
    let store = state
        .store
        .lock()
        .map_err(|_| "Graph store lock poisoned".to_string())?;
    store
        .clear()
        .map_err(|err| format!("Failed to clear graph store: {err}"))?;
    vault::remove_and_verify(&state.path)?;
    vault::remove_and_verify(&state.legacy_dir)?;
    Ok(())
}

pub fn is_empty(state: &GraphState) -> Result<bool, String> {
    let store = state
        .store
        .lock()
        .map_err(|_| "Graph store lock poisoned".to_string())?;
    store
        .is_empty()
        .map_err(|err| format!("Failed to inspect graph emptiness: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn entry_triples_can_be_asserted_queried_and_retracted() {
        let store = Store::new().expect("in-memory store should open");
        let entry = GraphEntryInput {
            id: "entry-1".to_string(),
            day: "2026-09-09".to_string(),
            created_at: "2026-09-09T10:00:00Z".to_string(),
            updated_at: "2026-09-09T10:00:00Z".to_string(),
            text: "A quiet forest walk".to_string(),
            tags: vec!["reflection".to_string()],
            concepts: vec!["forest".to_string()],
        };

        assert_entry(&store, &entry).expect("entry assertion should succeed");
        let query = store
            .query("SELECT ?entry WHERE { ?entry <https://citadel.local/ontology/day> \"2026-09-09\" }")
            .expect("query should succeed");
        match query {
            QueryResults::Solutions(mut solutions) => {
                assert_eq!(
                    solutions
                        .next()
                        .expect("one row")
                        .expect("valid row")
                        .get("entry")
                        .is_some(),
                    true
                );
            }
            _ => panic!("expected solution results"),
        }

        retract_subject(
            &store,
            &entry_subject(&entry.id).expect("entry IRI should be valid"),
        )
        .expect("entry retraction should succeed");
        let query = store
            .query("ASK { ?entry <https://citadel.local/ontology/day> \"2026-09-09\" }")
            .expect("query should succeed");
        assert!(matches!(query, QueryResults::Boolean(false)));
    }

    #[test]
    fn persistent_projection_survives_restart_and_rebuilds_idempotently() {
        use crate::journal_log::{JournalEntryInput, JournalState};

        let temp = tempfile::tempdir().expect("temporary app-data directory");
        let journal = JournalState::open_test(temp.path()).expect("journal opens");
        journal
            .append_entry(JournalEntryInput {
                id: "synthetic-restart-entry".into(),
                day: "2026-10-14".into(),
                created_at: "2026-10-14T10:00:00Z".into(),
                updated_at: "2026-10-14T10:00:00Z".into(),
                text: "synthetic persistence fixture".into(),
                tags: vec!["fixture".into()],
                metadata: Default::default(),
                timezone_offset: 0,
                level: None,
                period: None,
            })
            .expect("journal append is durable");
        let events = journal.verified_events().expect("journal verifies");
        let entries = events
            .iter()
            .map(|event| GraphEntryInput {
                id: event.payload.entry_id.clone(),
                day: event.payload.day.clone(),
                created_at: event.payload.created_at.clone(),
                updated_at: event.payload.updated_at.clone(),
                text: event.payload.text.clone(),
                tags: event.payload.tags.clone(),
                concepts: vec!["restart".into()],
            })
            .collect::<Vec<_>>();
        let db_path = PathBuf::from(temp.path()).join("citadel_graph");
        {
            let graph = open(&db_path, journal.vault_key()).expect("encrypted graph opens");
            for entry in &entries {
                project_entry(&graph, entry).expect("log-derived projection writes");
            }
            let encrypted = std::fs::read(temp.path().join("citadel_graph.enc")).unwrap();
            assert!(encrypted.starts_with(b"CTVLT001"));
            assert!(!encrypted
                .windows(b"synthetic persistence fixture".len())
                .any(|window| window == b"synthetic persistence fixture"));
        }
        drop(journal);

        let reopened_journal = JournalState::open_test(temp.path()).expect("journal reopens");
        let reopened_events = reopened_journal
            .verified_events()
            .expect("journal chain verifies after restart");
        let reopened =
            open(&db_path, reopened_journal.vault_key()).expect("encrypted graph reopens");
        let rebuilt_entries = reopened_events
            .iter()
            .map(|event| GraphEntryInput {
                id: event.payload.entry_id.clone(),
                day: event.payload.day.clone(),
                created_at: event.payload.created_at.clone(),
                updated_at: event.payload.updated_at.clone(),
                text: event.payload.text.clone(),
                tags: event.payload.tags.clone(),
                concepts: vec!["restart".into()],
            })
            .collect::<Vec<_>>();
        rebuild_projection(&reopened, &rebuilt_entries)
            .expect("startup rebuild restores graph from journal");
        let query = reopened
            .store
            .lock()
            .expect("graph lock")
            .query("ASK { <https://citadel.local/ontology/entry/synthetic-restart-entry> <https://citadel.local/ontology/day> \"2026-10-14\" }")
            .expect("query should work after restart");
        assert!(matches!(query, QueryResults::Boolean(true)));

        rebuild_projection(&reopened, &rebuilt_entries).expect("repeated projection is idempotent");
        let store = reopened.store.lock().expect("graph lock");
        let rows = store
            .query("SELECT ?entry WHERE { ?entry <https://citadel.local/ontology/day> \"2026-10-14\" }")
            .expect("query should work after rebuild");
        match rows {
            QueryResults::Solutions(solutions) => assert_eq!(solutions.count(), 1),
            _ => panic!("expected solutions"),
        }
    }
}
