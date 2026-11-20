use crate::graph::GraphState;
use crate::journal_log::{JournalEvent, JournalState};
use crate::semantic_engine::SemanticState;
use crate::sync::ingestion::{ingest_event, IngestDisposition};
use crate::sync::reconciliation::root_for_events;
use crate::sync::roster::SyncState;
use crate::sync::SyncReport;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MAX_BUNDLE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_BUNDLE_EVENTS: usize = 10_000;
const MAX_EVENT_TEXT_BYTES: usize = 1024 * 1024;
const MAX_METADATA_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoneBundle {
    pub citadel_bundle_version: u32,
    pub exported_at: String,
    pub author_identity: String,
    pub event_count: usize,
    pub merkle_root: String,
    pub checksum: String,
    pub events: Vec<JournalEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleExportResult {
    pub file_path: String,
    pub event_count: usize,
    pub merkle_root: String,
    pub checksum: String,
}

pub fn export_bundle(
    journal: &JournalState,
    sync_state: &SyncState,
    destination: Option<PathBuf>,
) -> Result<BundleExportResult, String> {
    let path = destination.ok_or_else(|| {
        "Choose an export destination outside Citadel's encrypted app-data directory".to_string()
    })?;
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."))
        .canonicalize()
        .map_err(|error| format!("Cannot verify stone bundle destination: {error}"))?;
    let app_data_root = journal
        .root()
        .canonicalize()
        .map_err(|error| format!("Cannot verify encrypted app-data directory: {error}"))?;
    if parent.starts_with(&app_data_root) {
        return Err("Stone bundle exports cannot be written inside Citadel app data".into());
    }
    let filename = path
        .file_name()
        .ok_or_else(|| "Stone bundle export destination must name a file".to_string())?;
    let path = parent.join(filename);
    if let Ok(metadata) = fs::symlink_metadata(&path) {
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("Stone bundle export destination must be a regular file".into());
        }
    }

    let events = journal.verified_events()?;
    let merkle_root = root_for_events(&events);
    let author_identity = sync_state.local_card()?.identity_pubkey;
    let exported_at = chrono_or_now();

    let events_serialized =
        serde_json::to_vec(&events).map_err(|e| format!("Cannot serialize bundle events: {e}"))?;
    let checksum = blake3::hash(&events_serialized).to_hex().to_string();

    let bundle = StoneBundle {
        citadel_bundle_version: 1,
        exported_at,
        author_identity,
        event_count: events.len(),
        merkle_root: merkle_root.clone(),
        checksum: checksum.clone(),
        events,
    };

    let bundle_bytes = serde_json::to_vec_pretty(&bundle)
        .map_err(|e| format!("Cannot format stone bundle: {e}"))?;

    fs::write(&path, &bundle_bytes)
        .map_err(|e| format!("Cannot write stone bundle to {}: {e}", path.display()))?;

    Ok(BundleExportResult {
        file_path: path.to_string_lossy().to_string(),
        event_count: bundle.event_count,
        merkle_root,
        checksum,
    })
}

pub fn import_bundle(
    path: &Path,
    journal: &JournalState,
    graph_state: &GraphState,
    semantic: &SemanticState,
    sync_state: &SyncState,
) -> Result<SyncReport, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Cannot inspect stone bundle file: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Stone bundle import target must be a regular file".into());
    }
    if metadata.len() > MAX_BUNDLE_BYTES {
        return Err(format!(
            "Stone bundle exceeds the {MAX_BUNDLE_BYTES}-byte import limit"
        ));
    }
    let bytes = fs::read(path).map_err(|e| format!("Cannot read stone bundle file: {e}"))?;
    let bundle: StoneBundle =
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid Citadel stone bundle: {e}"))?;

    if bundle.event_count != bundle.events.len() {
        return Err("Stone bundle event count does not match its event list".into());
    }
    if bundle.events.len() > MAX_BUNDLE_EVENTS {
        return Err(format!(
            "Stone bundle exceeds the {MAX_BUNDLE_EVENTS}-event import limit"
        ));
    }
    for (index, event) in bundle.events.iter().enumerate() {
        validate_import_event(event, index)?;
    }

    if bundle.citadel_bundle_version != 1 {
        return Err(format!(
            "Unsupported bundle version: {}",
            bundle.citadel_bundle_version
        ));
    }

    // Verify integrity checksum
    let events_serialized = serde_json::to_vec(&bundle.events)
        .map_err(|e| format!("Cannot serialize bundle events for validation: {e}"))?;
    let expected_checksum = blake3::hash(&events_serialized).to_hex().to_string();
    if expected_checksum != bundle.checksum {
        return Err("Tamper detected: stone bundle checksum mismatch".into());
    }

    let mut received = 0usize;
    let mut duplicates = 0usize;
    let mut quarantined = 0usize;

    for event in bundle.events {
        match ingest_event(journal, graph_state, sync_state, event) {
            Ok(IngestDisposition::Appended) => received += 1,
            Ok(IngestDisposition::AlreadyKnown) => duplicates += 1,
            Err(e) => {
                eprintln!("[citadel] bundle import rejected stone: {e}");
                quarantined += 1;
            }
        }
    }

    let final_events = journal.verified_events()?;
    if received > 0 {
        let _ = semantic.rebuild(&final_events);
    }

    let local_merkle_root = root_for_events(&final_events);
    let converged = local_merkle_root == bundle.merkle_root;

    Ok(SyncReport {
        local_event_count: final_events.len(),
        peer_event_count: bundle.event_count,
        local_merkle_root,
        peer_merkle_root: bundle.merkle_root,
        received,
        duplicates,
        quarantined,
        converged,
    })
}

fn validate_import_event(event: &JournalEvent, index: usize) -> Result<(), String> {
    let label = format!("event {}", index + 1);
    for (name, value, maximum) in [
        ("event ID", event.event_id.as_str(), 256usize),
        ("timestamp", event.timestamp.as_str(), 64),
        ("entry ID", event.payload.entry_id.as_str(), 256),
        ("day", event.payload.day.as_str(), 32),
        ("createdAt", event.payload.created_at.as_str(), 64),
        ("updatedAt", event.payload.updated_at.as_str(), 64),
    ] {
        if value.len() > maximum {
            return Err(format!(
                "Stone bundle {label} {name} exceeds {maximum} bytes"
            ));
        }
    }
    if event.payload.text.len() > MAX_EVENT_TEXT_BYTES {
        return Err(format!(
            "Stone bundle {label} text exceeds {MAX_EVENT_TEXT_BYTES} bytes"
        ));
    }
    if event.payload.tags.len() > 128 || event.payload.tags.iter().any(|tag| tag.len() > 128) {
        return Err(format!(
            "Stone bundle {label} tag count or size exceeds limits"
        ));
    }
    if event.payload.metadata.len() > 128 {
        return Err(format!("Stone bundle {label} has too many metadata fields"));
    }
    let metadata_bytes = serde_json::to_vec(&event.payload.metadata)
        .map_err(|error| format!("Cannot size {label} metadata: {error}"))?;
    if metadata_bytes.len() > MAX_METADATA_BYTES {
        return Err(format!(
            "Stone bundle {label} metadata exceeds {MAX_METADATA_BYTES} bytes"
        ));
    }
    if event.signature.len() != 128
        || event.event_hash.len() != 64
        || event.parent_hash.len() != 64
        || event.author_pubkey.len() != 64
    {
        return Err(format!(
            "Stone bundle {label} has malformed cryptographic field lengths"
        ));
    }
    if let Some(provenance) = &event.payload.migration_provenance {
        if provenance.original_id.len() > 256
            || provenance.migration_key.len() > 256
            || provenance.source_refs.len() > 1024
            || provenance
                .source_refs
                .iter()
                .any(|source| source.len() > 2048)
            || provenance.source_checksum.len() != 64
        {
            return Err(format!(
                "Stone bundle {label} migration provenance exceeds limits"
            ));
        }
    }
    Ok(())
}

fn chrono_or_now() -> String {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("timestamp-{}", duration.as_secs())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph;
    use crate::journal_log::JournalEntryInput;

    #[test]
    fn bundle_export_and_import_roundtrip() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let _graph = graph::open(&temp.path().join("graph"), journal.vault_key()).unwrap();
        let sync = SyncState::open(temp.path(), &journal, journal.vault_key()).unwrap();
        let _semantic = SemanticState::open(
            temp.path(),
            Path::new("/dummy/model.onnx"),
            Path::new("/dummy/vocab.txt"),
            &[],
            journal.vault_key(),
        );

        journal
            .append_entry(JournalEntryInput {
                id: "stone-bundle-test-1".into(),
                day: "2026-10-14".into(),
                created_at: "2026-10-14T10:00:00Z".into(),
                updated_at: "2026-10-14T10:00:00Z".into(),
                text: "Testing cold stone bundle export".into(),
                tags: vec!["bundle".into()],
                metadata: Default::default(),
                timezone_offset: 0,
                level: None,
                period: None,
            })
            .unwrap();

        let export_dir = tempfile::tempdir().unwrap();
        let bundle_out = export_dir.path().join("test.citadel-sync");
        let export_result = export_bundle(&journal, &sync, Some(bundle_out.clone())).unwrap();
        assert_eq!(export_result.event_count, 1);
        assert!(bundle_out.exists());

        // Import into new ephemeral node
        let temp_dest = tempfile::tempdir().unwrap();
        let journal_dest = JournalState::open_test(temp_dest.path()).unwrap();
        let graph_dest =
            graph::open(&temp_dest.path().join("graph"), journal_dest.vault_key()).unwrap();
        let sync_dest =
            SyncState::open(temp_dest.path(), &journal_dest, journal_dest.vault_key()).unwrap();
        let semantic_dest = SemanticState::open(
            temp_dest.path(),
            Path::new("/dummy/model.onnx"),
            Path::new("/dummy/vocab.txt"),
            &[],
            journal_dest.vault_key(),
        );

        // Pin source identity on destination
        let source_card = sync.local_card().unwrap();
        sync_dest
            .pin_device(source_card.identity_pubkey, source_card.noise_static_pubkey)
            .unwrap();

        let report = import_bundle(
            &bundle_out,
            &journal_dest,
            &graph_dest,
            &semantic_dest,
            &sync_dest,
        )
        .unwrap();
        assert_eq!(report.received, 1);
        assert_eq!(report.duplicates, 0);
        assert_eq!(report.quarantined, 0);
        assert!(report.converged);
    }

    #[test]
    fn cit_01_sync_export_requires_explicit_destination_outside_app_data() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let sync = SyncState::open(temp.path(), &journal, journal.vault_key()).unwrap();

        let no_destination = export_bundle(&journal, &sync, None);
        assert!(no_destination
            .unwrap_err()
            .contains("Choose an export destination"));
        assert!(!temp
            .path()
            .join("sync")
            .read_dir()
            .unwrap()
            .any(|entry| entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("citadel-export-")));

        let in_app_data = temp.path().join("plain-export.citadel-sync");
        let result = export_bundle(&journal, &sync, Some(in_app_data.clone()));
        assert!(result.unwrap_err().contains("inside Citadel app data"));
        assert!(!in_app_data.exists());
    }

    #[test]
    fn cit_10_bundle_file_size_is_rejected_before_read() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let key = journal.vault_key().clone();
        let graph = graph::open(&temp.path().join("graph"), &key).unwrap();
        let semantic = SemanticState::open(
            temp.path(),
            Path::new("missing.onnx"),
            Path::new("missing.txt"),
            &[],
            &key,
        );
        let sync = SyncState::open(temp.path(), &journal, &key).unwrap();
        let bundle_path = temp.path().join("oversized.citadel-sync");
        let file = fs::File::create(&bundle_path).unwrap();
        file.set_len(MAX_BUNDLE_BYTES + 1).unwrap();

        let error = import_bundle(&bundle_path, &journal, &graph, &semantic, &sync)
            .err()
            .unwrap();
        assert!(error.contains("import limit"), "{error}");
        assert!(journal.verified_events().unwrap().is_empty());
    }

    #[test]
    fn cit_10_bundle_event_fields_are_capped_before_ingestion() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let key = journal.vault_key().clone();
        let graph = graph::open(&temp.path().join("graph"), &key).unwrap();
        let semantic = SemanticState::open(
            temp.path(),
            Path::new("missing.onnx"),
            Path::new("missing.txt"),
            &[],
            &key,
        );
        let sync = SyncState::open(temp.path(), &journal, &key).unwrap();
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&[7u8; 32]);
        let event = JournalEvent {
            event_id: "oversized".into(),
            parent_hash: crate::journal_log::GENESIS_HASH.into(),
            timestamp: "2026-10-19T00:00:00Z".into(),
            timezone_offset: 0,
            author_pubkey: hex::encode(signing_key.verifying_key().to_bytes()),
            payload: crate::journal_log::EntryPayload {
                entry_id: "entry".into(),
                day: "2026-10-19".into(),
                created_at: "2026-10-19T00:00:00Z".into(),
                updated_at: "2026-10-19T00:00:00Z".into(),
                text: "x".repeat(MAX_EVENT_TEXT_BYTES + 1),
                tags: vec![],
                metadata: Default::default(),
                migration_provenance: None,
                level: None,
                period: None,
            },
            signature: "0".repeat(128),
            event_hash: "0".repeat(64),
        };
        let bundle = StoneBundle {
            citadel_bundle_version: 1,
            exported_at: "2026-10-19T00:00:00Z".into(),
            author_identity: hex::encode(signing_key.verifying_key().to_bytes()),
            event_count: 1,
            merkle_root: "0".repeat(64),
            checksum: "0".repeat(64),
            events: vec![event],
        };
        let path = temp.path().join("oversized-field.citadel-sync");
        fs::write(&path, serde_json::to_vec(&bundle).unwrap()).unwrap();

        let error = import_bundle(&path, &journal, &graph, &semantic, &sync)
            .err()
            .unwrap();
        assert!(error.contains("text exceeds"), "{error}");
        assert!(journal.verified_events().unwrap().is_empty());
    }
}
