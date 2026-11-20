use crate::journal_log::{timestamp_now, JournalEntryInput, JournalState, MigrationProvenance};
use crate::vault;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const RECEIPT_FILE: &str = "migration_receipt.json";
const PROFILE_FILE: &str = "citadel-profile.json";
const BACKUP_DIR: &str = "legacy_storage_backup";
const SOURCE_AAD: &[u8] = b"citadel-legacy-source-v1";
const BACKUP_AAD: &[u8] = b"citadel-migration-backup-v1";
const PROFILE_AAD: &[u8] = b"citadel-profile-v1";
const RECEIPT_AAD: &[u8] = b"citadel-migration-receipt-v1";
const MAX_LEGACY_JSON_BYTES: usize = 64 * 1024 * 1024;
const MAX_LEGACY_EVENTS: usize = 10_000;
const MAX_LEGACY_EVENT_TEXT_BYTES: usize = 1024 * 1024;
const MAX_LEGACY_METADATA_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MigrationReceipt {
    pub started_at: String,
    pub completed_at: String,
    pub source_checksums: BTreeMap<String, String>,
    pub legacy_candidates: usize,
    pub imported_events: usize,
    pub identical_duplicates: usize,
    pub collisions: usize,
    pub imported_payload_checksum: String,
    pub chain_head_hash: String,
}

#[derive(Debug, Clone)]
struct Candidate {
    source_ref: String,
    source_checksum: String,
    original_id: String,
    entry: JournalEntryInput,
    content_key: String,
}

#[derive(Debug, Clone)]
struct Group {
    original_id: String,
    entry: JournalEntryInput,
    source_refs: Vec<String>,
    source_checksum: String,
    collision: bool,
    migration_key: String,
}

pub fn migrate_app_data(journal: &JournalState) -> Result<MigrationReceipt, String> {
    let mut sources = Vec::new();
    for basename in ["citadel-state.json", "state.json"] {
        let path = journal.root().join(basename);
        if path.is_file() {
            let metadata = fs::metadata(&path)
                .map_err(|error| format!("Cannot inspect legacy source {basename}: {error}"))?;
            if metadata.len() > MAX_LEGACY_JSON_BYTES as u64 {
                return Err(format!(
                    "Legacy source {basename} exceeds {MAX_LEGACY_JSON_BYTES}-byte limit"
                ));
            }
            let (bytes, _) =
                vault::read_encrypted_or_legacy(&path, journal.vault_key(), SOURCE_AAD)
                    .map_err(|e| format!("Cannot snapshot {basename}: {e}"))?;
            sources.push((basename.to_string(), bytes));
            continue;
        }
        let backup_dir = journal.root().join(BACKUP_DIR);
        if backup_dir.exists() {
            let files = fs::read_dir(&backup_dir)
                .map_err(|error| format!("Cannot inspect legacy backups: {error}"))?;
            let prefix = format!("{}.", sanitize_id(basename));
            for file in files {
                let file =
                    file.map_err(|error| format!("Cannot inspect legacy backup entry: {error}"))?;
                let name = file.file_name().to_string_lossy().to_string();
                if name.starts_with(&prefix) && name.ends_with(".snapshot") {
                    let metadata = file
                        .metadata()
                        .map_err(|error| format!("Cannot inspect legacy backup {name}: {error}"))?;
                    if metadata.len() > MAX_LEGACY_JSON_BYTES as u64 + 64 {
                        return Err(format!(
                            "Legacy backup {name} exceeds {MAX_LEGACY_JSON_BYTES}-byte limit"
                        ));
                    }
                    let (bytes, _) = vault::read_encrypted_or_legacy(
                        &file.path(),
                        journal.vault_key(),
                        BACKUP_AAD,
                    )
                    .map_err(|e| format!("Cannot resume legacy snapshot {name}: {e}"))?;
                    sources.push((basename.to_string(), bytes));
                }
            }
        }
    }
    migrate_sources(journal, sources)
}

pub fn migrate_browser_snapshot(
    journal: &JournalState,
    raw_json: &str,
) -> Result<MigrationReceipt, String> {
    if raw_json.len() > MAX_LEGACY_JSON_BYTES {
        return Err(format!(
            "Browser snapshot exceeds {MAX_LEGACY_JSON_BYTES}-byte limit"
        ));
    }
    migrate_sources(
        journal,
        vec![("citadel-v2-state".to_string(), raw_json.as_bytes().to_vec())],
    )
}

fn migrate_sources(
    journal: &JournalState,
    sources: Vec<(String, Vec<u8>)>,
) -> Result<MigrationReceipt, String> {
    let root = journal.root();
    let started_at = now();
    let existing_receipt = match read_receipt(root, journal.vault_key()) {
        Ok(receipt) => receipt,
        Err(_) if !root.join(RECEIPT_FILE).exists() => MigrationReceipt::default(),
        Err(error) => return Err(format!("Cannot read existing migration receipt: {error}")),
    };
    let mut source_checksums = existing_receipt.source_checksums.clone();
    let mut all_candidates = Vec::new();
    let mut parsed_values = Vec::new();

    for (source_name, raw) in sources {
        let checksum = blake3::hash(&raw).to_hex().to_string();
        source_checksums.insert(format!("{source_name}#{checksum}"), checksum.clone());
        write_snapshot(root, &source_name, &checksum, &raw, journal.vault_key())?;
        let value: Value = serde_json::from_slice(&raw)
            .map_err(|e| format!("Legacy source {source_name} is not valid JSON: {e}"))?;
        let entries = collect_entries(&value, &source_name, &checksum)?;
        if all_candidates.len().saturating_add(entries.len()) > MAX_LEGACY_EVENTS {
            return Err(format!(
                "Legacy snapshot exceeds {MAX_LEGACY_EVENTS}-event limit"
            ));
        }
        all_candidates.extend(entries);
        parsed_values.push((source_name, value));
    }

    if !root.join(PROFILE_FILE).exists() {
        if let Some((_, value)) = parsed_values
            .iter()
            .find(|(name, _)| name == "citadel-state.json")
            .or_else(|| parsed_values.iter().find(|(name, _)| name == "state.json"))
            .or_else(|| {
                parsed_values
                    .iter()
                    .find(|(name, _)| name == "citadel-v2-state")
            })
        {
            let profile = strip_journal_entries(value.clone());
            atomic_write(
                root,
                PROFILE_FILE,
                &serde_json::to_vec_pretty(&profile).map_err(|e| e.to_string())?,
                journal.vault_key(),
                PROFILE_AAD,
            )?;
        }
    }

    let candidate_count = all_candidates.len();
    let groups = group_candidates(all_candidates);
    let identical_duplicates = candidate_count.saturating_sub(groups.len());
    for (index, mut group) in groups.into_iter().enumerate() {
        let is_collision = group.collision;
        if is_collision {
            group.entry.id = format!("{}~collision-{}", group.original_id, index + 1);
            group
                .entry
                .metadata
                .insert("migrationCollision".into(), Value::Bool(true));
            group.entry.metadata.insert(
                "originalId".into(),
                Value::String(group.original_id.clone()),
            );
        }
        let provenance = MigrationProvenance {
            original_id: group.original_id,
            source_refs: group.source_refs,
            source_checksum: group.source_checksum,
            collision: is_collision,
            migration_key: group.migration_key,
        };
        journal.append_migration_entry(group.entry, provenance)?;
    }

    let events = journal.verified_events()?;
    let migration_events = events
        .iter()
        .filter(|event| event.payload.migration_provenance.is_some())
        .collect::<Vec<_>>();
    let imported_payload_checksum = blake3::hash(
        migration_events
            .iter()
            .flat_map(|event| event.event_hash.as_bytes().iter().copied())
            .collect::<Vec<_>>()
            .as_slice(),
    )
    .to_hex()
    .to_string();
    let identical_duplicates_total: usize = migration_events
        .iter()
        .map(|event| {
            event
                .payload
                .migration_provenance
                .as_ref()
                .map(|p| p.source_refs.len().saturating_sub(1))
                .unwrap_or(0)
        })
        .sum();
    archive_native_sources(root, &source_checksums, journal.vault_key())?;
    let receipt = MigrationReceipt {
        started_at: if existing_receipt.started_at.is_empty() {
            started_at
        } else {
            existing_receipt.started_at
        },
        completed_at: now(),
        source_checksums,
        legacy_candidates: migration_events.len() + identical_duplicates_total,
        imported_events: migration_events.len(),
        identical_duplicates: identical_duplicates_total.max(identical_duplicates),
        collisions: migration_events
            .iter()
            .filter(|event| {
                event
                    .payload
                    .migration_provenance
                    .as_ref()
                    .map(|p| p.collision)
                    .unwrap_or(false)
            })
            .count(),
        imported_payload_checksum,
        chain_head_hash: events
            .last()
            .map(|event| event.event_hash.clone())
            .unwrap_or_else(|| "0".repeat(64)),
    };
    atomic_write(
        root,
        RECEIPT_FILE,
        &serde_json::to_vec_pretty(&receipt).map_err(|e| e.to_string())?,
        journal.vault_key(),
        RECEIPT_AAD,
    )?;
    Ok(receipt)
}

fn archive_native_sources(
    root: &Path,
    source_checksums: &BTreeMap<String, String>,
    key: &crate::vault::VaultKey,
) -> Result<(), String> {
    let backup_dir = root.join(BACKUP_DIR);
    for basename in ["citadel-state.json", "state.json"] {
        let source = root.join(basename);
        if !source.is_file() {
            continue;
        }
        let (raw, _) = vault::read_encrypted_or_legacy(&source, key, SOURCE_AAD)
            .map_err(|e| format!("Cannot re-read migrated {basename}: {e}"))?;
        let checksum = blake3::hash(&raw).to_hex().to_string();
        if !source_checksums.contains_key(&format!("{basename}#{checksum}")) {
            continue;
        }
        let snapshot = backup_dir.join(format!("{}.{}.snapshot", sanitize_id(basename), checksum));
        let (snapshot_bytes, _) = vault::read_encrypted_or_legacy(&snapshot, key, BACKUP_AAD)
            .map_err(|e| format!("Cannot verify backup snapshot for {basename}: {e}"))?;
        if snapshot_bytes != raw {
            return Err(format!("Legacy backup verification failed for {basename}"));
        }
        vault::remove_and_verify(&source)?;
    }
    Ok(())
}

fn collect_entries(
    value: &Value,
    source: &str,
    source_checksum: &str,
) -> Result<Vec<Candidate>, String> {
    let state = value.get("state").unwrap_or(value);
    let Some(days) = state.get("days").and_then(Value::as_object) else {
        return Ok(Vec::new());
    };
    let mut candidates = Vec::new();
    for (day_key, cell) in days {
        let Some(entries) = cell.get("entries").and_then(Value::as_array) else {
            continue;
        };
        for (index, raw_entry) in entries.iter().enumerate() {
            let Some(entry_object) = raw_entry.as_object() else {
                continue;
            };
            let day = string_field(entry_object, "day").unwrap_or_else(|| day_key.clone());
            let original_id = string_field(entry_object, "id").unwrap_or_else(|| {
                format!(
                    "legacy-{}-{}-{}",
                    &source_checksum[..12],
                    sanitize_id(&day),
                    index + 1
                )
            });
            let created_at = string_field(entry_object, "createdAt")
                .or_else(|| string_field(entry_object, "created_at"))
                .unwrap_or_default();
            let updated_at = string_field(entry_object, "updatedAt")
                .or_else(|| string_field(entry_object, "updated_at"))
                .unwrap_or_else(|| created_at.clone());
            let text = string_field(entry_object, "text").unwrap_or_default();
            let tags_value = entry_object.get("tags").cloned().unwrap_or(Value::Null);
            let tags = tags_value
                .as_array()
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_owned)
                        .collect()
                })
                .unwrap_or_default();
            let known = [
                "id",
                "day",
                "createdAt",
                "created_at",
                "updatedAt",
                "updated_at",
                "text",
                "tags",
            ];
            let mut metadata = entry_object
                .iter()
                .filter(|(key, _)| !known.contains(&key.as_str()))
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect::<BTreeMap<_, _>>();
            if let Some(raw_tags) = tags_value.as_array() {
                if raw_tags.iter().any(|tag| !tag.is_string()) {
                    metadata.insert("legacyRawTags".into(), tags_value);
                }
            } else if !tags_value.is_null() {
                metadata.insert("legacyRawTags".into(), tags_value);
            }
            let entry = JournalEntryInput {
                id: original_id.clone(),
                day,
                created_at: created_at.clone(),
                updated_at,
                text,
                tags,
                metadata,
                timezone_offset: parse_timezone_offset(&created_at),
                level: None,
                period: None,
            };
            validate_legacy_entry(&entry, candidates.len())?;
            let bytes = serde_json::to_vec(&entry).map_err(|e| e.to_string())?;
            let content_key = blake3::hash(&bytes).to_hex().to_string();
            candidates.push(Candidate {
                source_ref: format!("{source}@{source_checksum}#{}:{}", original_id, index),
                source_checksum: source_checksum.to_string(),
                original_id,
                entry,
                content_key,
            });
        }
    }
    Ok(candidates)
}

fn validate_legacy_entry(entry: &JournalEntryInput, index: usize) -> Result<(), String> {
    let label = format!("Legacy entry {}", index + 1);
    for (name, value, maximum) in [
        ("ID", entry.id.as_str(), 256usize),
        ("day", entry.day.as_str(), 32),
        ("createdAt", entry.created_at.as_str(), 64),
        ("updatedAt", entry.updated_at.as_str(), 64),
    ] {
        if value.len() > maximum {
            return Err(format!("{label} {name} exceeds {maximum} bytes"));
        }
    }
    if entry.text.len() > MAX_LEGACY_EVENT_TEXT_BYTES {
        return Err(format!(
            "{label} text exceeds {MAX_LEGACY_EVENT_TEXT_BYTES} bytes"
        ));
    }
    if entry.tags.len() > 128 || entry.tags.iter().any(|tag| tag.len() > 128) {
        return Err(format!("{label} tag count or size exceeds limits"));
    }
    if entry.metadata.len() > 128 {
        return Err(format!("{label} has too many metadata fields"));
    }
    let metadata_bytes = serde_json::to_vec(&entry.metadata).map_err(|error| error.to_string())?;
    if metadata_bytes.len() > MAX_LEGACY_METADATA_BYTES {
        return Err(format!(
            "{label} metadata exceeds {MAX_LEGACY_METADATA_BYTES} bytes"
        ));
    }
    Ok(())
}

fn group_candidates(candidates: Vec<Candidate>) -> Vec<Group> {
    let mut by_id: BTreeMap<String, Vec<Candidate>> = BTreeMap::new();
    for candidate in candidates {
        by_id
            .entry(candidate.original_id.clone())
            .or_default()
            .push(candidate);
    }
    let mut groups = Vec::new();
    for (original_id, candidates) in by_id {
        let collision = candidates
            .iter()
            .map(|candidate| candidate.content_key.as_str())
            .collect::<std::collections::HashSet<_>>()
            .len()
            > 1;
        let mut by_content: BTreeMap<String, Vec<Candidate>> = BTreeMap::new();
        for candidate in candidates {
            by_content
                .entry(candidate.content_key.clone())
                .or_default()
                .push(candidate);
        }
        for (content_key, candidates) in by_content {
            let first = candidates.first().expect("content group is non-empty");
            let source_refs = candidates
                .iter()
                .map(|candidate| candidate.source_ref.clone())
                .collect::<Vec<_>>();
            let migration_key = blake3::hash(format!("{original_id}\0{content_key}").as_bytes())
                .to_hex()
                .to_string();
            groups.push(Group {
                original_id: original_id.clone(),
                entry: first.entry.clone(),
                source_refs,
                source_checksum: first.source_checksum.clone(),
                collision,
                migration_key,
            });
        }
    }
    groups
}

fn strip_journal_entries(mut value: Value) -> Value {
    if let Some(state) = value.get_mut("state") {
        strip_days(state);
    } else {
        strip_days(&mut value);
    }
    value
}

fn strip_days(value: &mut Value) {
    if let Some(days) = value.get_mut("days").and_then(Value::as_object_mut) {
        for cell in days.values_mut() {
            if let Some(cell) = cell.as_object_mut() {
                cell.insert("entries".into(), Value::Array(Vec::new()));
            }
        }
    }
}

fn write_snapshot(
    root: &Path,
    source: &str,
    checksum: &str,
    bytes: &[u8],
    key: &crate::vault::VaultKey,
) -> Result<PathBuf, String> {
    let backup_dir = root.join(BACKUP_DIR);
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Cannot create legacy backup directory: {e}"))?;
    let path = backup_dir.join(format!("{}.{}.snapshot", sanitize_id(source), checksum));
    if !path.exists() {
        vault::write_encrypted(&path, bytes, key, BACKUP_AAD)?;
    }
    Ok(path)
}

fn atomic_write(
    root: &Path,
    basename: &str,
    bytes: &[u8],
    key: &crate::vault::VaultKey,
    aad: &[u8],
) -> Result<(), String> {
    vault::write_encrypted(&root.join(basename), bytes, key, aad)
}

fn read_receipt(root: &Path, key: &crate::vault::VaultKey) -> Result<MigrationReceipt, String> {
    let path = root.join(RECEIPT_FILE);
    let (raw, legacy) = vault::read_encrypted_or_legacy(&path, key, RECEIPT_AAD)?;
    if legacy {
        vault::write_encrypted(&path, &raw, key, RECEIPT_AAD)?;
    }
    serde_json::from_slice(&raw).map_err(|e| e.to_string())
}

fn string_field(object: &Map<String, Value>, key: &str) -> Option<String> {
    object.get(key).and_then(Value::as_str).map(str::to_owned)
}

fn sanitize_id(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn now() -> String {
    timestamp_now()
}

fn parse_timezone_offset(timestamp: &str) -> i32 {
    if timestamp.ends_with('Z') || timestamp.len() < 6 {
        return 0;
    }
    if !timestamp.is_char_boundary(timestamp.len() - 6) {
        return 0;
    }
    let suffix = &timestamp[timestamp.len() - 6..];
    let sign = match suffix.as_bytes()[0] {
        b'+' => 1,
        b'-' => -1,
        _ => return 0,
    };
    let Some((hours, minutes)) = suffix[1..].split_once(':') else {
        return 0;
    };
    match (hours.parse::<i32>(), minutes.parse::<i32>()) {
        (Ok(hours), Ok(minutes)) if hours <= 23 && minutes <= 59 => sign * (hours * 60 + minutes),
        _ => 0,
    }
}

#[tauri::command]
pub fn journal_migrate_browser_snapshot(
    runtime: tauri::State<'_, crate::VaultRuntime>,
    raw_json: String,
) -> Result<MigrationReceipt, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    migrate_browser_snapshot(&journal, &raw_json)
}

#[tauri::command]
pub fn journal_read_profile(
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<Option<Value>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let path = journal.root().join(PROFILE_FILE);
    if !path.exists() {
        return Ok(None);
    }
    let (raw, legacy) = vault::read_encrypted_or_legacy(&path, journal.vault_key(), PROFILE_AAD)
        .map_err(|e| format!("Cannot read local profile: {e}"))?;
    if legacy {
        vault::write_encrypted(&path, &raw, journal.vault_key(), PROFILE_AAD)?;
    }
    serde_json::from_slice(&raw)
        .map(Some)
        .map_err(|e| format!("Invalid local profile JSON: {e}"))
}

#[tauri::command]
pub fn journal_save_profile(
    runtime: tauri::State<'_, crate::VaultRuntime>,
    profile: Value,
) -> Result<(), String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let profile = strip_journal_entries(profile);
    let bytes = serde_json::to_vec(&profile).map_err(|e| format!("Cannot encode profile: {e}"))?;
    atomic_write(
        journal.root(),
        PROFILE_FILE,
        &bytes,
        journal.vault_key(),
        PROFILE_AAD,
    )
}

#[tauri::command]
pub fn journal_migration_receipt(
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<Option<MigrationReceipt>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    match read_receipt(journal.root(), journal.vault_key()) {
        Ok(receipt) => Ok(Some(receipt)),
        Err(_) if !journal.root().join(RECEIPT_FILE).exists() => Ok(None),
        Err(error) => Err(format!("Cannot read migration receipt: {error}")),
    }
}

pub fn wipe_migration_and_profile(root: &Path) -> Result<Vec<String>, String> {
    let mut cleared = Vec::new();
    for basename in [
        PROFILE_FILE,
        RECEIPT_FILE,
        "citadel-state.json",
        "state.json",
    ] {
        let path = root.join(basename);
        vault::remove_and_verify(&path)?;
        cleared.push(format!("tauri:app_data/{basename}"));
    }

    let backup_dir = root.join(BACKUP_DIR);
    vault::remove_and_verify(&backup_dir)?;
    cleared.push(format!("tauri:app_data/{BACKUP_DIR}/"));

    Ok(cleared)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal_log::JournalState;

    fn legacy_entry(id: &str, text: &str) -> Value {
        serde_json::json!({
            "id": id,
            "createdAt": "2023-04-05T06:07:08-04:00",
            "updatedAt": "2023-04-06T07:08:09-04:00",
            "text": text,
            "tags": ["one", "two"],
            "customLegacyField": { "keep": true }
        })
    }

    #[test]
    fn migration_snapshots_preserves_entries_and_resumes_without_duplicates() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let legacy = serde_json::json!({
            "version": 1,
            "state": {
                "today": "2023-04-06",
                "days": {
                    "2023-04-05": { "entries": [
                        legacy_entry("same", "line one\nline two"),
                        legacy_entry("same", "line one\nline two")
                    ] }
                }
            }
        });
        let raw = serde_json::to_vec(&legacy).unwrap();
        fs::write(temp.path().join("citadel-state.json"), &raw).unwrap();
        let receipt = migrate_app_data(&journal).unwrap();
        assert_eq!(receipt.imported_events, 1);
        assert_eq!(receipt.identical_duplicates, 1);
        assert_eq!(receipt.legacy_candidates, 2);
        assert_eq!(receipt.source_checksums.len(), 1);
        assert_eq!(receipt.imported_payload_checksum.len(), 64);
        assert!(temp.path().join(RECEIPT_FILE).is_file());
        assert!(fs::read(temp.path().join(RECEIPT_FILE))
            .unwrap()
            .starts_with(b"CTVLT001"));
        assert!(fs::read(temp.path().join(PROFILE_FILE))
            .unwrap()
            .starts_with(b"CTVLT001"));
        let migrated = journal.read_entries().unwrap().remove(0);
        assert_eq!(migrated.id, "same");
        assert_eq!(migrated.day, "2023-04-05");
        assert_eq!(migrated.text, "line one\nline two");
        assert_eq!(migrated.created_at, "2023-04-05T06:07:08-04:00");
        assert_eq!(migrated.updated_at, "2023-04-06T07:08:09-04:00");
        assert_eq!(migrated.tags, vec!["one", "two"]);
        assert_eq!(
            migrated.metadata["customLegacyField"]["keep"],
            Value::Bool(true)
        );
        let provenance = migrated.migration_provenance.unwrap();
        assert_eq!(provenance.original_id, "same");
        assert_eq!(provenance.source_refs.len(), 2);
        assert_eq!(provenance.source_checksum.len(), 64);
        assert_eq!(journal.verified_events().unwrap()[0].timezone_offset, -240);
        assert!(temp
            .path()
            .join(BACKUP_DIR)
            .read_dir()
            .unwrap()
            .next()
            .is_some());
        assert!(!temp.path().join("citadel-state.json").exists());
        let snapshot_path = temp.path().join(BACKUP_DIR).join(format!(
            "citadel-state_json.{}.snapshot",
            blake3::hash(&raw).to_hex()
        ));
        assert_eq!(
            vault::read_encrypted_or_legacy(&snapshot_path, journal.vault_key(), BACKUP_AAD)
                .unwrap()
                .0,
            raw
        );
        let encrypted_snapshot = fs::read(&snapshot_path).unwrap();
        assert!(encrypted_snapshot.starts_with(b"CTVLT001"));
        assert!(!encrypted_snapshot
            .windows(b"line one".len())
            .any(|window| window == b"line one"));
        let profile: Value = serde_json::from_slice(
            &vault::read_encrypted_or_legacy(
                &temp.path().join(PROFILE_FILE),
                journal.vault_key(),
                PROFILE_AAD,
            )
            .unwrap()
            .0,
        )
        .unwrap();
        assert!(profile["state"]["days"]["2023-04-05"]["entries"]
            .as_array()
            .unwrap()
            .is_empty());

        let repeated = migrate_app_data(&journal).unwrap();
        assert_eq!(repeated.imported_events, 1);
        assert_eq!(journal.verification().unwrap().event_count, 1);
    }

    #[test]
    fn conflicting_ids_are_both_kept_and_marked() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let raw = serde_json::json!({
            "state": { "days": { "2023-04-05": { "entries": [
                legacy_entry("collision", "first synthetic text"),
                legacy_entry("collision", "second synthetic text")
            ] } } }
        });
        let receipt = migrate_browser_snapshot(&journal, &raw.to_string()).unwrap();
        let entries = journal.read_entries().unwrap();
        assert_eq!(receipt.collisions, 2);
        assert_eq!(entries.len(), 2);
        assert_ne!(entries[0].id, entries[1].id);
        assert!(entries
            .iter()
            .all(|entry| entry.migration_provenance.as_ref().unwrap().collision));
    }

    #[test]
    fn cit_10_browser_snapshot_rejects_oversized_entry_before_ingestion() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let oversized = serde_json::json!({
            "state": { "days": { "2026-10-19": { "entries": [
                legacy_entry("oversized", &"x".repeat(MAX_LEGACY_EVENT_TEXT_BYTES + 1))
            ] } } }
        });

        let result = migrate_browser_snapshot(&journal, &oversized.to_string());
        assert!(result.unwrap_err().contains("text exceeds"));
        assert!(journal.verified_events().unwrap().is_empty());
    }

    #[test]
    fn cit_05_full_wipe_clears_journal_migration_backup_graph_semantic_and_sync_stores() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();

        // 1. Seed journal & migration artifacts (citadel-profile.json, migration_receipt.json, legacy_storage_backup/)
        let journal = JournalState::open_test(root).unwrap();
        let legacy = serde_json::json!({
            "version": 1,
            "state": {
                "today": "2023-04-06",
                "days": {
                    "2023-04-05": { "entries": [legacy_entry("e1", "memory alpha")] }
                }
            }
        });
        fs::write(
            root.join("citadel-state.json"),
            serde_json::to_vec(&legacy).unwrap(),
        )
        .unwrap();
        migrate_app_data(&journal).unwrap();

        assert!(root.join("journal.log").exists());
        assert!(root.join(PROFILE_FILE).exists());
        assert!(root.join(RECEIPT_FILE).exists());
        assert!(root.join(BACKUP_DIR).exists());

        // 2. Seed Oxigraph RDF store (citadel_graph/)
        let graph_dir = root.join("citadel_graph");
        let graph = crate::graph::open(&graph_dir, journal.vault_key()).unwrap();
        crate::graph::rebuild_projection(
            &graph,
            &[crate::graph::GraphEntryInput {
                id: "e1".into(),
                day: "2023-04-05".into(),
                created_at: "2023-04-05T06:07:08Z".into(),
                updated_at: "2023-04-05T06:07:08Z".into(),
                text: "memory alpha".into(),
                tags: vec!["one".into()],
                concepts: vec!["alpha".into()],
            }],
        )
        .unwrap();
        assert!(!crate::graph::is_empty(&graph).unwrap());

        // 3. Seed Semantic index (semantic_index/index.json)
        let events = journal.verified_events().unwrap();
        let semantic = crate::semantic_engine::SemanticState::open(
            root,
            &root.join("missing_model.onnx"),
            &root.join("missing_vocab.txt"),
            &events,
            journal.vault_key(),
        );
        fs::create_dir_all(root.join("semantic_index")).unwrap();
        fs::write(root.join("semantic_index").join("index.json"), b"{}").unwrap();
        assert!(root.join("semantic_index").join("index.json").exists());

        // 4. Seed Sync roster & quarantine (sync/known_devices.json, quarantine/)
        let sync =
            crate::sync::roster::SyncState::open(root, &journal, journal.vault_key()).unwrap();
        let noise_key_before = sync.local_card().unwrap().noise_static_pubkey;
        let device_key_before = fs::read(root.join("device.ed25519")).unwrap();
        fs::create_dir_all(root.join("sync")).unwrap();
        fs::write(root.join("sync").join("known_devices.json"), b"[]").unwrap();
        fs::create_dir_all(root.join("quarantine")).unwrap();
        fs::write(root.join("quarantine").join("bad.frame"), b"corrupt").unwrap();
        let mut webview_storage = crate::vault_storage::WebviewStorage::new();
        webview_storage.insert(
            "citadel_sigma_chat_archives".into(),
            "private archive".into(),
        );
        crate::vault_storage::save(root, journal.vault_key(), &webview_storage).unwrap();
        let portable_root = root.join("portable-root");
        fs::create_dir_all(portable_root.join("world/saves")).unwrap();
        fs::create_dir_all(portable_root.join("prefs")).unwrap();
        crate::write_portable_user_data(
            &portable_root.join("world/saves/citadel-main.json"),
            b"private portable save",
            journal.vault_key(),
        )
        .unwrap();
        crate::write_portable_user_data(
            &portable_root.join("prefs/browser-prefs.json"),
            b"private portable preferences",
            journal.vault_key(),
        )
        .unwrap();

        // 5. Execute the same native wipe operation used by the Tauri command.
        let wipe_report =
            crate::wipe_unlocked_stores(&journal, &graph, &semantic, &sync, Some(&portable_root))
                .unwrap();
        assert!(
            wipe_report.survivors.is_empty(),
            "wipe survivors: {:?}",
            wipe_report.survivors
        );

        // 6. Verify zero survivors across every path
        assert_eq!(journal.read_entries().unwrap().len(), 0);
        assert!(!root.join("journal.log").exists());
        assert!(!root.join(PROFILE_FILE).exists());
        assert!(!root.join(RECEIPT_FILE).exists());
        assert!(!root.join("citadel-state.json").exists());
        assert!(!root.join("state.json").exists());
        assert!(!root.join(BACKUP_DIR).exists());
        assert!(crate::graph::is_empty(&graph).unwrap());
        assert!(!root.join("citadel_graph").exists());
        assert!(!root.join("citadel_graph.enc").exists());
        assert!(!root.join("semantic_index").join("index.json").exists());
        assert!(!root.join("sync").join("known_devices.json").exists());
        assert!(!root.join("quarantine").exists());
        assert!(!root.join("webview_storage.json").exists());
        assert!(!portable_root.join("world").exists());
        assert!(!portable_root.join("prefs").exists());
        assert!(!root.join("semantic_index").exists());
        assert_ne!(
            noise_key_before,
            sync.local_card().unwrap().noise_static_pubkey
        );
        assert_eq!(
            fs::read(root.join("device.ed25519")).unwrap(),
            device_key_before
        );
        for path in [
            "journal.log",
            "journal.head",
            PROFILE_FILE,
            RECEIPT_FILE,
            BACKUP_DIR,
            "citadel-state.json",
            "state.json",
            "citadel_graph",
            "citadel_graph.enc",
            "semantic_index",
            "sync/known_devices.json",
            "quarantine",
            "webview_storage.json",
        ] {
            assert!(
                fs::symlink_metadata(root.join(path)).is_err(),
                "residual path: {path}"
            );
        }
    }
}
