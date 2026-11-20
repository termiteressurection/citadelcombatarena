use crate::graph::{self, GraphEntryInput, GraphState};
use crate::journal_log::{ForeignAppend, JournalEvent, JournalState};
use crate::sync::roster::SyncState;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IngestDisposition {
    Appended,
    AlreadyKnown,
}

pub fn ingest_event(
    journal: &JournalState,
    graph_state: &GraphState,
    sync_state: &SyncState,
    event: JournalEvent,
) -> Result<IngestDisposition, String> {
    if !sync_state.is_known_identity(&event.author_pubkey)? {
        let reason = "Event author is not in the known-device roster";
        quarantine_event(sync_state.quarantine(), &event, reason)?;
        return Err(reason.into());
    }

    match journal.append_foreign_event(event.clone()) {
        Ok(ForeignAppend::AlreadyKnown) => Ok(IngestDisposition::AlreadyKnown),
        Ok(ForeignAppend::Appended) => {
            let graph_entry = GraphEntryInput {
                id: event.payload.entry_id.clone(),
                day: event.payload.day.clone(),
                created_at: event.payload.created_at.clone(),
                updated_at: event.payload.updated_at.clone(),
                text: event.payload.text.clone(),
                tags: event.payload.tags.clone(),
                concepts: event
                    .payload
                    .metadata
                    .get("concepts")
                    .and_then(serde_json::Value::as_array)
                    .map(|values| {
                        values
                            .iter()
                            .filter_map(serde_json::Value::as_str)
                            .map(str::to_owned)
                            .collect()
                    })
                    .unwrap_or_default(),
            };
            if let Err(error) = graph::project_entry(graph_state, &graph_entry) {
                // The append is canonical and durable already. The graph is a
                // disposable projection, so attempt a complete replay and keep
                // the accepted stone even if that replay also fails.
                let events = journal.verified_events()?;
                let projection = events
                    .iter()
                    .map(|entry| GraphEntryInput {
                        id: entry.payload.entry_id.clone(),
                        day: entry.payload.day.clone(),
                        created_at: entry.payload.created_at.clone(),
                        updated_at: entry.payload.updated_at.clone(),
                        text: entry.payload.text.clone(),
                        tags: entry.payload.tags.clone(),
                        concepts: entry
                            .payload
                            .metadata
                            .get("concepts")
                            .and_then(serde_json::Value::as_array)
                            .map(|values| {
                                values
                                    .iter()
                                    .filter_map(serde_json::Value::as_str)
                                    .map(str::to_owned)
                                    .collect()
                            })
                            .unwrap_or_default(),
                    })
                    .collect::<Vec<_>>();
                graph::rebuild_projection(graph_state, &projection).map_err(|rebuild_error| {
                    format!("Accepted stone; RDF replay failed ({error}; {rebuild_error})")
                })?;
            }
            Ok(IngestDisposition::Appended)
        }
        Err(reason) => {
            quarantine_event(sync_state.quarantine(), &event, &reason)?;
            Err(reason)
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConflictRecord<'a> {
    kind: &'static str,
    event_id: &'a str,
    event_hash: &'a str,
    author_pubkey: &'a str,
    reason: &'a str,
}

pub fn quarantine_event(
    quarantine: &crate::sync::quarantine::QuarantineStore,
    event: &JournalEvent,
    reason: &str,
) -> Result<(), String> {
    let bytes = serde_json::to_vec(event)
        .map_err(|error| format!("Cannot encode quarantined stone: {error}"))?;
    let digest = blake3::hash(&bytes).to_hex().to_string();
    quarantine.write_record(&format!("stone-{digest}.json"), &bytes)?;
    quarantine.append_json_line(
        "conflicts.jsonl",
        &ConflictRecord {
            kind: "foreign-stone",
            event_id: &event.event_id,
            event_hash: &event.event_hash,
            author_pubkey: &event.author_pubkey,
            reason,
        },
    )
}
