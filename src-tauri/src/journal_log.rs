use crate::vault::{self, VaultKey};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

pub const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";
const LOG_FILE: &str = "journal.log";
const CHECKPOINT_FILE: &str = "journal.head";
const KEY_FILE: &str = "device.ed25519";
const LOG_AAD: &[u8] = b"citadel-journal-log-v1";
const IDENTITY_AAD: &[u8] = b"citadel-device-ed25519-v1";
const TRUST_FILE: &str = "sync/trusted_authors.json";
const TRUST_AAD: &[u8] = b"citadel-trusted-author-set-v1";
const ROSTER_AAD: &[u8] = b"citadel-sync-roster-v1";
const CHECKPOINT_AAD: &[u8] = b"citadel-journal-checkpoint-v1";

#[derive(Clone)]
pub struct AuthorTrust {
    path: PathBuf,
    key: VaultKey,
    authors: std::sync::Arc<Mutex<BTreeSet<String>>>,
}

#[derive(Deserialize)]
struct LegacyRosterIdentity {
    identity_pubkey: String,
}

impl AuthorTrust {
    fn load(root: &Path, key: &VaultKey, local_identity: &str) -> Result<Self, String> {
        let path = root.join(TRUST_FILE);
        let mut authors = if path.exists() {
            let (bytes, legacy) = vault::read_encrypted_or_legacy(&path, key, TRUST_AAD)?;
            let values: Vec<String> = serde_json::from_slice(&bytes)
                .map_err(|error| format!("Invalid trusted-author set: {error}"))?;
            if legacy {
                vault::write_encrypted(&path, &bytes, key, TRUST_AAD)?;
            }
            values.into_iter().collect::<BTreeSet<_>>()
        } else {
            let roster_path = root.join("sync/known_devices.json");
            if roster_path.exists() {
                let (bytes, _) = vault::read_encrypted_or_legacy(&roster_path, key, ROSTER_AAD)
                    .map_err(|error| format!("Cannot migrate pinned-author trust: {error}"))?;
                serde_json::from_slice::<Vec<LegacyRosterIdentity>>(&bytes)
                    .map_err(|error| format!("Invalid known-device roster: {error}"))?
                    .into_iter()
                    .map(|device| device.identity_pubkey)
                    .collect()
            } else {
                BTreeSet::new()
            }
        };
        authors.insert(local_identity.to_string());
        for author in &authors {
            validate_author_key(author)?;
        }
        let trust = Self {
            path,
            key: key.clone(),
            authors: std::sync::Arc::new(Mutex::new(authors)),
        };
        trust.persist()?;
        Ok(trust)
    }

    pub fn snapshot(&self) -> Result<BTreeSet<String>, String> {
        self.authors
            .lock()
            .map(|authors| authors.clone())
            .map_err(|_| "Trusted-author lock poisoned".to_string())
    }

    pub fn contains(&self, author: &str) -> Result<bool, String> {
        self.authors
            .lock()
            .map(|authors| authors.contains(author))
            .map_err(|_| "Trusted-author lock poisoned".to_string())
    }

    pub fn add(&self, author: &str) -> Result<(), String> {
        validate_author_key(author)?;
        let mut authors = self
            .authors
            .lock()
            .map_err(|_| "Trusted-author lock poisoned".to_string())?;
        if authors.insert(author.to_string()) {
            self.persist_values(&authors)?;
        }
        Ok(())
    }

    pub fn reset_to_local(&self, local_identity: &str) -> Result<(), String> {
        let mut authors = self
            .authors
            .lock()
            .map_err(|_| "Trusted-author lock poisoned".to_string())?;
        authors.clear();
        authors.insert(local_identity.to_string());
        self.persist_values(&authors)
    }

    fn persist(&self) -> Result<(), String> {
        let authors = self
            .authors
            .lock()
            .map_err(|_| "Trusted-author lock poisoned".to_string())?;
        self.persist_values(&authors)
    }

    fn persist_values(&self, authors: &BTreeSet<String>) -> Result<(), String> {
        let bytes = serde_json::to_vec(&authors.iter().collect::<Vec<_>>())
            .map_err(|error| format!("Cannot encode trusted-author set: {error}"))?;
        vault::write_encrypted(&self.path, &bytes, &self.key, TRUST_AAD)
    }
}

fn validate_author_key(author: &str) -> Result<(), String> {
    let bytes =
        hex::decode(author).map_err(|_| "Trusted author key must be hexadecimal".to_string())?;
    if bytes.len() != 32 {
        return Err("Trusted author key must be exactly 32 bytes".into());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryInput {
    pub id: String,
    pub day: String,
    pub created_at: String,
    pub updated_at: String,
    pub text: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub metadata: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    pub timezone_offset: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EntryPayload {
    pub entry_id: String,
    pub day: String,
    pub created_at: String,
    pub updated_at: String,
    pub text: String,
    pub tags: Vec<String>,
    pub metadata: BTreeMap<String, serde_json::Value>,
    pub migration_provenance: Option<MigrationProvenance>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MigrationProvenance {
    pub original_id: String,
    pub source_refs: Vec<String>,
    pub source_checksum: String,
    pub collision: bool,
    pub migration_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEvent {
    pub event_id: String,
    pub parent_hash: String,
    pub timestamp: String,
    pub timezone_offset: i32,
    pub author_pubkey: String,
    pub payload: EntryPayload,
    pub signature: String,
    pub event_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SignableEvent<'a> {
    event_id: &'a str,
    parent_hash: &'a str,
    timestamp: &'a str,
    timezone_offset: i32,
    author_pubkey: &'a str,
    payload: &'a EntryPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayStatus {
    pub day: String,
    pub is_crystallized: bool,
    pub event_count: usize,
    pub seal_event_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalVerification {
    pub valid: bool,
    pub event_count: usize,
    pub head_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeadCheckpoint {
    event_count: usize,
    head_hash: String,
    signature: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SignableCheckpoint<'a> {
    event_count: usize,
    head_hash: &'a str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntryView {
    pub id: String,
    pub day: String,
    pub created_at: String,
    pub updated_at: String,
    pub text: String,
    pub tags: Vec<String>,
    pub metadata: BTreeMap<String, serde_json::Value>,
    pub migration_provenance: Option<MigrationProvenance>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
}

pub struct JournalState {
    root: PathBuf,
    log_path: PathBuf,
    checkpoint_path: PathBuf,
    signing_key: SigningKey,
    vault_key: VaultKey,
    author_trust: AuthorTrust,
    events: Mutex<Vec<JournalEvent>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ForeignAppend {
    Appended,
    AlreadyKnown,
}

impl JournalState {
    pub fn open_with_key(app_data_dir: &Path, vault_key: &VaultKey) -> Result<Self, String> {
        fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Cannot create app data directory: {e}"))?;
        let signing_key = load_or_create_key(&app_data_dir.join(KEY_FILE), vault_key)?;
        let local_identity = hex::encode(signing_key.verifying_key().to_bytes());
        let author_trust = AuthorTrust::load(app_data_dir, vault_key, &local_identity)?;
        let log_path = app_data_dir.join(LOG_FILE);
        let checkpoint_path = app_data_dir.join(CHECKPOINT_FILE);
        let (events, legacy_log) = load_log(&log_path, vault_key)?;
        verify_events(&events, &local_identity, &author_trust.snapshot()?)?;
        verify_or_initialize_checkpoint(
            &checkpoint_path,
            &events,
            &signing_key,
            vault_key,
            legacy_log,
        )?;
        Ok(Self {
            root: app_data_dir.to_path_buf(),
            log_path,
            checkpoint_path,
            signing_key,
            vault_key: vault_key.clone(),
            author_trust,
            events: Mutex::new(events),
        })
    }

    #[cfg(test)]
    pub fn open_test(app_data_dir: &Path) -> Result<Self, String> {
        Self::open_with_key(app_data_dir, &VaultKey::test_key())
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn vault_key(&self) -> &VaultKey {
        &self.vault_key
    }

    pub fn author_trust(&self) -> AuthorTrust {
        self.author_trust.clone()
    }

    pub fn identity_public_key(&self) -> String {
        hex::encode(self.signing_key.verifying_key().to_bytes())
    }

    pub fn log_path(&self) -> &Path {
        &self.log_path
    }

    pub fn verified_events(&self) -> Result<Vec<JournalEvent>, String> {
        let events = self
            .events
            .lock()
            .map_err(|_| "Journal lock poisoned".to_string())?;
        verify_events(
            &events,
            &self.identity_public_key(),
            &self.author_trust.snapshot()?,
        )?;
        Ok(events.clone())
    }

    pub fn append_entry(&self, input: JournalEntryInput) -> Result<JournalEvent, String> {
        self.append(input, None, None)
    }

    pub fn append_migration_entry(
        &self,
        input: JournalEntryInput,
        provenance: MigrationProvenance,
    ) -> Result<JournalEvent, String> {
        let event_id = format!("migration_{}", provenance.migration_key);
        self.append(input, Some(provenance), Some(event_id))
    }

    fn append(
        &self,
        input: JournalEntryInput,
        provenance: Option<MigrationProvenance>,
        event_id: Option<String>,
    ) -> Result<JournalEvent, String> {
        if input.id.trim().is_empty() {
            return Err("Journal entry ID cannot be empty".into());
        }
        let mut events = self
            .events
            .lock()
            .map_err(|_| "Journal lock poisoned".to_string())?;
        let payload = EntryPayload {
            entry_id: input.id,
            day: input.day,
            created_at: input.created_at,
            updated_at: input.updated_at,
            text: input.text,
            tags: input.tags,
            metadata: input.metadata,
            migration_provenance: provenance,
            level: input.level,
            period: input.period,
        };

        if let Some(existing) = events.iter().find(|event| {
            event.event_id == event_id.as_deref().unwrap_or_default()
                || event.payload.entry_id == payload.entry_id
        }) {
            if existing.payload == payload {
                return Ok(existing.clone());
            }
            return Err(format!(
                "Entry ID {} already has a different immutable inscription",
                payload.entry_id
            ));
        }

        let is_seal = payload.tags.iter().any(|t| t == "day-seal");
        if !is_seal
            && events.iter().any(|e| {
                e.payload.day == payload.day && e.payload.tags.iter().any(|t| t == "day-seal")
            })
        {
            return Err(format!(
                "Day {} is crystallized into stone; historical entries are immutable",
                payload.day
            ));
        }

        let timestamp = timestamp_now();
        let author_pubkey = hex::encode(self.signing_key.verifying_key().to_bytes());
        let parent_hash = events
            .iter()
            .rev()
            .find(|event| event.author_pubkey == author_pubkey)
            .map(|event| event.event_hash.clone())
            .unwrap_or_else(|| GENESIS_HASH.to_string());
        let mut nonce = [0_u8; 16];
        OsRng.fill_bytes(&mut nonce);
        let event_id = event_id.unwrap_or_else(|| format!("evt_{}", hex::encode(nonce)));
        let signable = SignableEvent {
            event_id: &event_id,
            parent_hash: &parent_hash,
            timestamp: &timestamp,
            timezone_offset: input.timezone_offset,
            author_pubkey: &author_pubkey,
            payload: &payload,
        };
        let bytes =
            serde_json::to_vec(&signable).map_err(|e| format!("Cannot encode event: {e}"))?;
        let event_hash = blake3::hash(&bytes).to_hex().to_string();
        let signature = self.signing_key.sign(event_hash.as_bytes());
        let event = JournalEvent {
            event_id,
            parent_hash,
            timestamp,
            timezone_offset: input.timezone_offset,
            author_pubkey,
            payload,
            signature: hex::encode(signature.to_bytes()),
            event_hash,
        };

        persist_log(&self.log_path, &events, Some(&event), &self.vault_key)?;
        let mut next_events = events.clone();
        next_events.push(event.clone());
        persist_checkpoint(
            &self.checkpoint_path,
            &next_events,
            &self.signing_key,
            &self.vault_key,
        )?;
        events.push(event.clone());
        Ok(event)
    }

    /// Append an already signed peer event without changing any signed bytes.
    /// Caller must quarantine the event and its error on failure.
    pub fn append_foreign_event(&self, event: JournalEvent) -> Result<ForeignAppend, String> {
        verify_event_integrity(&event)?;
        if !self.author_trust.contains(&event.author_pubkey)? {
            return Err("Event author is not in the persisted trusted-author set".into());
        }
        let mut events = self
            .events
            .lock()
            .map_err(|_| "Journal lock poisoned".to_string())?;

        if events
            .iter()
            .any(|known| known.event_hash == event.event_hash)
        {
            return Ok(ForeignAppend::AlreadyKnown);
        }
        if events.iter().any(|known| known.event_id == event.event_id) {
            return Err("Event ID collision with different signed content".into());
        }

        let author_events = events
            .iter()
            .filter(|known| known.author_pubkey == event.author_pubkey)
            .collect::<Vec<_>>();
        let expected_parent = author_events
            .last()
            .map(|known| known.event_hash.as_str())
            .unwrap_or(GENESIS_HASH);
        if event.parent_hash != expected_parent {
            return Err(format!(
                "Fork quarantine: expected author head {}, received parent {}",
                expected_parent, event.parent_hash
            ));
        }
        if event.parent_hash != GENESIS_HASH
            && !events.iter().any(|known| {
                known.event_hash == event.parent_hash && known.author_pubkey == event.author_pubkey
            })
        {
            return Err("Unknown or cross-device parent hash".into());
        }
        if let Some(existing) = events
            .iter()
            .find(|known| known.payload.entry_id == event.payload.entry_id)
        {
            if existing.payload != event.payload {
                return Err("Entry ID collision with different immutable payload".into());
            }
        }

        persist_log(&self.log_path, &events, Some(&event), &self.vault_key)?;
        let mut next_events = events.clone();
        next_events.push(event.clone());
        persist_checkpoint(
            &self.checkpoint_path,
            &next_events,
            &self.signing_key,
            &self.vault_key,
        )?;
        events.push(event);
        Ok(ForeignAppend::Appended)
    }

    pub fn read_entries(&self) -> Result<Vec<JournalEntryView>, String> {
        let events = self.verified_events()?;
        Ok(events
            .into_iter()
            .map(|event| JournalEntryView {
                id: event.payload.entry_id,
                day: event.payload.day,
                created_at: event.payload.created_at,
                updated_at: event.payload.updated_at,
                text: event.payload.text,
                tags: event.payload.tags,
                metadata: event.payload.metadata,
                migration_provenance: event.payload.migration_provenance,
                level: event.payload.level,
                period: event.payload.period,
            })
            .collect())
    }

    pub fn verification(&self) -> Result<JournalVerification, String> {
        let events = self.verified_events()?;
        Ok(JournalVerification {
            valid: true,
            event_count: events.len(),
            head_hash: events
                .last()
                .map(|event| event.event_hash.clone())
                .unwrap_or_else(|| GENESIS_HASH.to_string()),
        })
    }

    pub fn is_day_crystallized(&self, day: &str) -> Result<bool, String> {
        let events = self
            .events
            .lock()
            .map_err(|_| "Journal lock poisoned".to_string())?;
        Ok(events
            .iter()
            .any(|e| e.payload.day == day && e.payload.tags.iter().any(|t| t == "day-seal")))
    }

    pub fn crystallize_day(&self, day: &str) -> Result<JournalEvent, String> {
        let events = self.verified_events()?;
        if let Some(existing) = events
            .iter()
            .find(|e| e.payload.day == day && e.payload.tags.iter().any(|t| t == "day-seal"))
        {
            return Ok(existing.clone());
        }
        let day_events: Vec<_> = events.iter().filter(|e| e.payload.day == day).collect();
        let seal_input = JournalEntryInput {
            id: format!("seal_{day}"),
            day: day.to_string(),
            created_at: timestamp_now(),
            updated_at: timestamp_now(),
            text: format!(
                "Day {day} crystallized into stone ({} events sealed).",
                day_events.len()
            ),
            tags: vec!["day-seal".into(), "crystallized".into()],
            metadata: BTreeMap::from([
                ("kind".into(), serde_json::Value::String("day_seal".into())),
                (
                    "sealedCount".into(),
                    serde_json::Value::Number(day_events.len().into()),
                ),
            ]),
            timezone_offset: 0,
            level: Some("day".into()),
            period: Some(day.to_string()),
        };
        self.append_entry(seal_input)
    }

    pub fn get_day_status(&self, day: &str) -> Result<DayStatus, String> {
        let events = self
            .events
            .lock()
            .map_err(|_| "Journal lock poisoned".to_string())?;
        let day_events: Vec<_> = events.iter().filter(|e| e.payload.day == day).collect();
        let seal = day_events
            .iter()
            .find(|e| e.payload.tags.iter().any(|t| t == "day-seal"));
        Ok(DayStatus {
            day: day.to_string(),
            is_crystallized: seal.is_some(),
            event_count: day_events.len(),
            seal_event_id: seal.map(|s| s.event_id.clone()),
        })
    }

    pub fn reset_all(&self) -> Result<(), String> {
        let mut events = self
            .events
            .lock()
            .map_err(|_| "Journal lock poisoned".to_string())?;
        events.clear();
        vault::remove_and_verify(&self.log_path)?;
        vault::remove_and_verify(&self.checkpoint_path)?;
        Ok(())
    }
}

pub(crate) fn timestamp_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let days = (now.as_secs() / 86_400) as i64;
    let seconds = now.as_secs() % 86_400;
    let (year, month, day) = civil_from_days(days);
    let hour = seconds / 3_600;
    let minute = (seconds % 3_600) / 60;
    let second = seconds % 60;
    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{:09}Z",
        now.subsec_nanos()
    )
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

fn load_or_create_key(path: &Path, vault_key: &VaultKey) -> Result<SigningKey, String> {
    if path.exists() {
        let metadata = fs::symlink_metadata(path)
            .map_err(|error| format!("Cannot inspect identity key: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("Device identity key must be a regular file".into());
        }
        let (bytes, was_legacy) = vault::read_encrypted_or_legacy(path, vault_key, IDENTITY_AAD)?;
        let secret: [u8; 32] = bytes
            .try_into()
            .map_err(|_| "Device identity key must be exactly 32 bytes".to_string())?;
        if was_legacy {
            vault::write_encrypted(path, &secret, vault_key, IDENTITY_AAD)?;
        }
        return Ok(SigningKey::from_bytes(&secret));
    }

    let mut secret = [0_u8; 32];
    OsRng.fill_bytes(&mut secret);
    vault::write_encrypted(path, &secret, vault_key, IDENTITY_AAD)?;
    Ok(SigningKey::from_bytes(&secret))
}

fn load_log(path: &Path, vault_key: &VaultKey) -> Result<(Vec<JournalEvent>, bool), String> {
    if !path.exists() {
        vault::write_encrypted(path, b"", vault_key, LOG_AAD)?;
        return Ok((Vec::new(), false));
    }
    let (bytes, was_legacy) = vault::read_encrypted_or_legacy(path, vault_key, LOG_AAD)?;
    let text = std::str::from_utf8(&bytes)
        .map_err(|error| format!("Journal log is not UTF-8: {error}"))?;
    let mut events = Vec::new();
    for (index, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            return Err(format!(
                "Journal log contains an empty line at {}",
                index + 1
            ));
        }
        let event = serde_json::from_str(line)
            .map_err(|error| format!("Invalid journal event at line {}: {error}", index + 1))?;
        events.push(event);
    }
    if was_legacy {
        persist_log(path, &events, None, vault_key)?;
    }
    Ok((events, was_legacy))
}

fn checkpoint_head(events: &[JournalEvent]) -> &str {
    events
        .last()
        .map(|event| event.event_hash.as_str())
        .unwrap_or(GENESIS_HASH)
}

fn checkpoint_signing_bytes(event_count: usize, head_hash: &str) -> Result<Vec<u8>, String> {
    serde_json::to_vec(&SignableCheckpoint {
        event_count,
        head_hash,
    })
    .map_err(|error| format!("Cannot encode journal head checkpoint: {error}"))
}

fn persist_checkpoint(
    path: &Path,
    events: &[JournalEvent],
    signing_key: &SigningKey,
    vault_key: &VaultKey,
) -> Result<(), String> {
    let head_hash = checkpoint_head(events).to_string();
    let bytes = checkpoint_signing_bytes(events.len(), &head_hash)?;
    let checkpoint = HeadCheckpoint {
        event_count: events.len(),
        head_hash,
        signature: hex::encode(signing_key.sign(&bytes).to_bytes()),
    };
    let encoded = serde_json::to_vec(&checkpoint)
        .map_err(|error| format!("Cannot serialize journal checkpoint: {error}"))?;
    vault::write_encrypted(path, &encoded, vault_key, CHECKPOINT_AAD)
}

fn verify_or_initialize_checkpoint(
    path: &Path,
    events: &[JournalEvent],
    signing_key: &SigningKey,
    vault_key: &VaultKey,
    legacy_log: bool,
) -> Result<(), String> {
    if !path.exists() {
        if !events.is_empty() && !legacy_log {
            return Err(
                "Signed journal checkpoint is missing for an encrypted non-empty journal".into(),
            );
        }
        return persist_checkpoint(path, events, signing_key, vault_key);
    }
    let (bytes, legacy) = vault::read_encrypted_or_legacy(path, vault_key, CHECKPOINT_AAD)?;
    let checkpoint: HeadCheckpoint = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid signed journal checkpoint: {error}"))?;
    let signed = checkpoint_signing_bytes(checkpoint.event_count, &checkpoint.head_hash)?;
    let signature_bytes = hex::decode(&checkpoint.signature)
        .map_err(|_| "Invalid journal checkpoint signature encoding".to_string())?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "Invalid journal checkpoint signature".to_string())?;
    signing_key
        .verifying_key()
        .verify(&signed, &signature)
        .map_err(|_| "Journal checkpoint signature does not match this device".to_string())?;
    if checkpoint.event_count != events.len() || checkpoint.head_hash != checkpoint_head(events) {
        return Err(format!(
            "Journal checkpoint mismatch: expected {} events at {}, found {} events at {}",
            checkpoint.event_count,
            checkpoint.head_hash,
            events.len(),
            checkpoint_head(events),
        ));
    }
    if legacy {
        vault::write_encrypted(path, &bytes, vault_key, CHECKPOINT_AAD)?;
    }
    Ok(())
}

fn persist_log(
    path: &Path,
    existing: &[JournalEvent],
    next: Option<&JournalEvent>,
    vault_key: &VaultKey,
) -> Result<(), String> {
    let mut bytes = Vec::new();
    for event in existing.iter().chain(next.into_iter()) {
        serde_json::to_writer(&mut bytes, event)
            .map_err(|error| format!("Cannot encode journal event: {error}"))?;
        bytes.push(b'\n');
    }
    vault::write_encrypted(path, &bytes, vault_key, LOG_AAD)
}

pub fn verify_event_integrity(event: &JournalEvent) -> Result<(), String> {
    let signable = SignableEvent {
        event_id: &event.event_id,
        parent_hash: &event.parent_hash,
        timestamp: &event.timestamp,
        timezone_offset: event.timezone_offset,
        author_pubkey: &event.author_pubkey,
        payload: &event.payload,
    };
    let bytes = serde_json::to_vec(&signable).map_err(|e| format!("Cannot encode event: {e}"))?;
    let computed_hash = blake3::hash(&bytes).to_hex().to_string();
    if event.event_hash != computed_hash {
        return Err("Journal event hash mismatch".into());
    }

    let public_bytes = hex::decode(&event.author_pubkey)
        .map_err(|_| "Invalid event author public key".to_string())?;
    let public_bytes: [u8; 32] = public_bytes
        .try_into()
        .map_err(|_| "Invalid event author public key length".to_string())?;
    let public_key = VerifyingKey::from_bytes(&public_bytes)
        .map_err(|_| "Invalid event author public key".to_string())?;
    let signature_bytes = hex::decode(&event.signature)
        .map_err(|_| "Invalid event signature encoding".to_string())?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "Invalid event signature".to_string())?;
    public_key
        .verify(event.event_hash.as_bytes(), &signature)
        .map_err(|_| "Event signature verification failed".to_string())
}

fn verify_events(
    events: &[JournalEvent],
    local_identity: &str,
    trusted_authors: &BTreeSet<String>,
) -> Result<(), String> {
    let mut hashes = BTreeMap::<&str, &JournalEvent>::new();
    let mut ids = BTreeMap::<&str, &str>::new();
    let mut author_heads = BTreeMap::<&str, &str>::new();
    for (index, event) in events.iter().enumerate() {
        if event.author_pubkey != local_identity && !trusted_authors.contains(&event.author_pubkey)
        {
            return Err(format!("Unknown journal author at event {}", index + 1));
        }
        verify_event_integrity(event)
            .map_err(|error| format!("Invalid journal event {}: {error}", index + 1))?;
        if hashes.insert(event.event_hash.as_str(), event).is_some() {
            return Err(format!("Duplicate event hash at event {}", index + 1));
        }
        if ids
            .insert(event.event_id.as_str(), event.event_hash.as_str())
            .is_some()
        {
            return Err(format!("Duplicate event ID at event {}", index + 1));
        }

        let expected_parent = author_heads
            .get(event.author_pubkey.as_str())
            .copied()
            .unwrap_or(GENESIS_HASH);
        if event.parent_hash != expected_parent {
            return Err(format!(
                "Journal branch mismatch at event {}: expected {}, found {}",
                index + 1,
                expected_parent,
                event.parent_hash
            ));
        }
        if event.parent_hash != GENESIS_HASH && !hashes.contains_key(event.parent_hash.as_str()) {
            return Err(format!("Journal parent missing at event {}", index + 1));
        }
        author_heads.insert(event.author_pubkey.as_str(), event.event_hash.as_str());
    }
    Ok(())
}

#[cfg(test)]
pub(crate) static TEST_CLOCK_OVERRIDE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

#[cfg(test)]
pub fn set_test_clock_day(day: Option<&str>) {
    *TEST_CLOCK_OVERRIDE.lock().unwrap() = day.map(str::to_string);
}

pub(crate) fn normalize_season_period_str(period: &str) -> String {
    let clean = period.trim().to_uppercase();
    if let Some((a, b)) = clean.split_once('-').or_else(|| clean.split_once(' ')) {
        let a = a.trim();
        let b = b.trim();
        if a.len() == 4 && a.chars().all(|c| c.is_ascii_digit()) {
            return format!("{a}-{b}");
        }
        if b.len() == 4 && b.chars().all(|c| c.is_ascii_digit()) {
            return format!("{b}-{a}");
        }
    }
    clean
}

pub(crate) fn resolve_writable_period(level: &str, timezone_offset_minutes: i32) -> String {
    #[cfg(test)]
    if let Some(override_val) = TEST_CLOCK_OVERRIDE.lock().unwrap().clone() {
        if override_val.len() == 10 && override_val.chars().filter(|&c| c == '-').count() == 2 {
            let parts: Vec<&str> = override_val.split('-').collect();
            if parts.len() == 3 {
                let year: i64 = parts[0].parse().unwrap_or(2026);
                let month: i64 = parts[1].parse().unwrap_or(10);
                let day: i64 = parts[2].parse().unwrap_or(20);
                return match level {
                    "day" => format!("{year:04}-{month:02}-{day:02}"),
                    "month" => format!("{year:04}-{month:02}"),
                    "season" => {
                        let season_name = match month {
                            1 | 2 | 12 => "WINTER",
                            3 | 4 | 5 => "SPRING",
                            6 | 7 | 8 => "SUMMER",
                            _ => "AUTUMN",
                        };
                        format!("{year:04}-{season_name}")
                    }
                    "year" => format!("{year:04}"),
                    _ => override_val,
                };
            }
        }
        return override_val;
    }

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let local_secs = now_secs as i64 + (timezone_offset_minutes as i64 * 60);
    let local_days = if local_secs >= 0 {
        local_secs / 86_400
    } else {
        (local_secs - 86_399) / 86_400
    };
    let (year, month, day) = civil_from_days(local_days);
    match level {
        "day" => format!("{year:04}-{month:02}-{day:02}"),
        "month" => format!("{year:04}-{month:02}"),
        "season" => {
            let season_name = match month {
                1 | 2 | 12 => "WINTER",
                3 | 4 | 5 => "SPRING",
                6 | 7 | 8 => "SUMMER",
                _ => "AUTUMN",
            };
            format!("{year:04}-{season_name}")
        }
        "year" => format!("{year:04}"),
        _ => format!("{year:04}-{month:02}-{day:02}"),
    }
}

#[allow(dead_code)]
pub(crate) fn resolve_writable_local_day(timezone_offset_minutes: i32) -> String {
    resolve_writable_period("day", timezone_offset_minutes)
}

pub(crate) fn assert_entry_period_writable(entry: &JournalEntryInput) -> Result<(), String> {
    let level = entry.level.as_deref().unwrap_or("day").trim().to_lowercase();
    match level.as_str() {
        "day" => {
            let writable_day = resolve_writable_period("day", entry.timezone_offset);
            if entry.day != writable_day {
                return Err(format!(
                    "Write rejected: day {} is not writable. Exactly one day is writable: current local day {writable_day}",
                    entry.day
                ));
            }
            if let Some(period) = &entry.period {
                if period != &entry.day {
                    return Err(format!(
                        "Write rejected: cross-level smuggling detected. Level 'day' entry has mismatched period '{period}' (expected day '{writable_day}')"
                    ));
                }
            }
        }
        "month" => {
            let period = entry.period.as_deref().unwrap_or(&entry.day).trim();
            // Reject day strings passed as month periods (smuggling prevention)
            if period.len() > 7 && period.chars().filter(|&c| c == '-').count() > 1 {
                return Err(format!(
                    "Write rejected: cross-level smuggling detected. Level 'month' entry has day-scoped period '{period}'"
                ));
            }
            let writable_month = resolve_writable_period("month", entry.timezone_offset);
            if period != writable_month {
                return Err(format!(
                    "Write rejected: month {period} is not writable. Exactly one month is writable: current local month {writable_month}"
                ));
            }
        }
        "season" => {
            let period = entry.period.as_deref().unwrap_or(&entry.day).trim();
            // Reject day or month strings passed as season periods
            if period.chars().all(|c| c.is_ascii_digit() || c == '-') && period.len() <= 10 && !period.chars().any(|c| c.is_alphabetic()) {
                return Err(format!(
                    "Write rejected: cross-level smuggling detected. Level 'season' entry has numeric period '{period}'"
                ));
            }
            let writable_season = resolve_writable_period("season", entry.timezone_offset);
            let normalized_target = normalize_season_period_str(period);
            let normalized_writable = normalize_season_period_str(&writable_season);
            if normalized_target != normalized_writable {
                return Err(format!(
                    "Write rejected: season {period} is not writable. Exactly one season is writable: current local season {writable_season}"
                ));
            }
        }
        "year" => {
            let period = entry.period.as_deref().unwrap_or(&entry.day).trim();
            if period.contains('-') || period.len() != 4 {
                return Err(format!(
                    "Write rejected: cross-level smuggling detected. Level 'year' entry has sub-year period '{period}'"
                ));
            }
            let writable_year = resolve_writable_period("year", entry.timezone_offset);
            if period != writable_year {
                return Err(format!(
                    "Write rejected: year {period} is not writable. Exactly one year is writable: current local year {writable_year}"
                ));
            }
        }
        unknown => {
            return Err(format!(
                "Write rejected: invalid journal level '{unknown}'. Valid levels are 'day', 'month', 'season', 'year'."
            ));
        }
    }
    Ok(())
}

#[allow(dead_code)]
pub(crate) fn assert_entry_day_writable(entry: &JournalEntryInput) -> Result<(), String> {
    assert_entry_period_writable(entry)
}

#[tauri::command]
pub fn journal_append_entry(
    runtime: State<'_, crate::VaultRuntime>,
    entry: JournalEntryInput,
) -> Result<JournalEvent, String> {
    assert_entry_period_writable(&entry)?;

    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let graph = &services.graph;
    let semantic = &services.semantic;
    let event = journal.append_entry(entry)?;
    let all_events = journal.verified_events()?;
    if let Err(error) = semantic.index_event(&event, &all_events) {
        eprintln!("[citadel] semantic index update deferred: {error}");
    }
    crate::graph::project_entry(
        &graph,
        &crate::graph::GraphEntryInput {
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
        },
    )?;
    Ok(event)
}

#[tauri::command]
pub fn journal_read_entries(
    runtime: State<'_, crate::VaultRuntime>,
) -> Result<Vec<JournalEntryView>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    journal.read_entries()
}

#[tauri::command]
pub fn journal_verify(
    runtime: State<'_, crate::VaultRuntime>,
) -> Result<JournalVerification, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    journal.verification()
}

#[tauri::command]
pub fn journal_crystallize_day(
    day: String,
    runtime: State<'_, crate::VaultRuntime>,
) -> Result<JournalEvent, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    journal.crystallize_day(&day)
}

#[tauri::command]
pub fn journal_get_day_status(
    day: String,
    runtime: State<'_, crate::VaultRuntime>,
) -> Result<DayStatus, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    journal.get_day_status(&day)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(id: &str, text: &str) -> JournalEntryInput {
        JournalEntryInput {
            id: id.into(),
            day: "2026-10-14".into(),
            created_at: "2026-10-14T10:00:00-04:00".into(),
            updated_at: "2026-10-14T10:00:00-04:00".into(),
            text: text.into(),
            tags: vec!["test".into()],
            metadata: BTreeMap::new(),
            timezone_offset: -240,
            level: None,
            period: None,
        }
    }

    #[test]
    fn crystallization_seals_day_and_forbids_historical_appends() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal
            .append_entry(input("living-1", "A living thought"))
            .unwrap();

        let status_before = journal.get_day_status("2026-10-14").unwrap();
        assert!(!status_before.is_crystallized);
        assert_eq!(status_before.event_count, 1);

        // Crystallize day into stone
        let seal = journal.crystallize_day("2026-10-14").unwrap();
        assert_eq!(seal.payload.entry_id, "seal_2026-10-14");

        let status_after = journal.get_day_status("2026-10-14").unwrap();
        assert!(status_after.is_crystallized);
        assert_eq!(status_after.event_count, 2);

        // Future append to crystallized day must be rejected
        let rejected = journal.append_entry(input("past-tamper", "Trying to change the past"));
        assert!(rejected.is_err());
        assert!(rejected.unwrap_err().contains("crystallized into stone"));
    }

    #[test]
    fn append_is_signed_chained_and_survives_reopen() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal
            .append_entry(input("entry-1", "synthetic test inscription"))
            .unwrap();
        assert!(journal.verification().unwrap().valid);
        drop(journal);

        let reopened = JournalState::open_test(temp.path()).unwrap();
        let report = reopened.verification().unwrap();
        assert_eq!(report.event_count, 1);
        assert_eq!(
            reopened.read_entries().unwrap()[0].text,
            "synthetic test inscription"
        );
    }

    #[test]
    fn immutable_entry_idempotence_and_tamper_detection() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal.append_entry(input("entry-1", "fixture")).unwrap();
        journal.append_entry(input("entry-1", "fixture")).unwrap();
        assert_eq!(journal.verification().unwrap().event_count, 1);
        assert!(journal
            .append_entry(input("entry-1", "changed fixture"))
            .is_err());

        let test_key = VaultKey::test_key();
        let mut event = load_log(&temp.path().join(LOG_FILE), &test_key)
            .unwrap()
            .0
            .remove(0);
        event.payload.text.push('!');
        fs::write(
            temp.path().join(LOG_FILE),
            format!("{}\n", serde_json::to_string(&event).unwrap()),
        )
        .unwrap();
        assert!(JournalState::open_test(temp.path()).is_err());
    }

    #[test]
    fn empty_app_data_has_a_clean_genesis_log() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        let report = journal.verification().unwrap();
        assert!(report.valid);
        assert_eq!(report.event_count, 0);
        assert_eq!(report.head_hash, GENESIS_HASH);
        assert!(journal.read_entries().unwrap().is_empty());
    }

    #[test]
    fn cit_08_startup_rejects_a_self_signed_forged_author_chain() {
        let root = tempfile::tempdir().unwrap();
        let attacker_dir = tempfile::tempdir().unwrap();
        let trusted = JournalState::open_test(root.path()).unwrap();
        let attacker = JournalState::open_test(attacker_dir.path()).unwrap();
        attacker
            .append_entry(input("forged", "self-signed forged record"))
            .unwrap();
        fs::copy(attacker.log_path(), trusted.log_path()).unwrap();
        drop(attacker);
        drop(trusted);

        let error = JournalState::open_test(root.path())
            .err()
            .expect("untrusted event must fail startup");
        assert!(error.contains("Unknown journal author"), "{error}");
    }

    #[test]
    fn cit_08_revocation_preserves_persisted_author_trust_for_existing_history() {
        let local_dir = tempfile::tempdir().unwrap();
        let peer_dir = tempfile::tempdir().unwrap();
        let key = VaultKey::test_key();
        let local = JournalState::open_with_key(local_dir.path(), &key).unwrap();
        let peer = JournalState::open_with_key(peer_dir.path(), &key).unwrap();
        let sync = crate::sync::roster::SyncState::open(local_dir.path(), &local, &key).unwrap();
        let peer_identity = peer.identity_public_key();
        sync.pin_device(peer_identity.clone(), "22".repeat(32))
            .unwrap();
        let event = peer
            .append_entry(input("peer-entry", "legitimate pinned peer event"))
            .unwrap();
        assert_eq!(
            local.append_foreign_event(event).unwrap(),
            ForeignAppend::Appended
        );
        sync.revoke_device(&peer_identity).unwrap();
        let graph = crate::graph::open(&local_dir.path().join("citadel_graph"), &key).unwrap();
        let post_revoke_event = peer
            .append_entry(input("revoked-peer-entry", "event after device revocation"))
            .unwrap();
        let rejected = crate::sync::ingestion::ingest_event(
            &local,
            &graph,
            &sync,
            post_revoke_event,
        )
        .unwrap_err();
        assert!(rejected.contains("known-device roster"));
        drop(sync);
        drop(peer);
        drop(local);

        let reopened = JournalState::open_with_key(local_dir.path(), &key).unwrap();
        assert_eq!(reopened.verification().unwrap().event_count, 1);
        assert!(
            !crate::sync::roster::SyncState::open(local_dir.path(), &reopened, &key)
                .unwrap()
                .is_known_identity(&peer_identity)
                .unwrap()
        );
    }

    #[test]
    fn cit_01_journal_and_device_identity_are_encrypted_at_rest() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal
            .append_entry(input("secret-entry", "private journal phrase"))
            .unwrap();
        let log = fs::read(temp.path().join(LOG_FILE)).unwrap();
        let identity = fs::read(temp.path().join(KEY_FILE)).unwrap();
        assert!(log.starts_with(b"CTVLT001"));
        assert!(identity.starts_with(b"CTVLT001"));
        assert!(!log
            .windows(b"private journal phrase".len())
            .any(|part| part == b"private journal phrase"));
        assert_eq!(journal.verified_events().unwrap().len(), 1);
    }

    #[test]
    fn cit_07_signed_checkpoint_rejects_valid_prefix_truncation() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal
            .append_entry(input("entry-one", "first record"))
            .unwrap();
        journal
            .append_entry(input("entry-two", "second record"))
            .unwrap();
        let events = journal.verified_events().unwrap();
        persist_log(journal.log_path(), &events[..1], None, journal.vault_key()).unwrap();
        drop(journal);

        let error = JournalState::open_test(temp.path())
            .err()
            .expect("truncation must fail startup");
        assert!(error.contains("Journal checkpoint mismatch"), "{error}");
    }

    #[test]
    fn cit_07_missing_checkpoint_fails_closed_for_encrypted_nonempty_log() {
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal
            .append_entry(input("entry-one", "first record"))
            .unwrap();
        drop(journal);

        fs::remove_file(temp.path().join(CHECKPOINT_FILE)).unwrap();
        let error = JournalState::open_test(temp.path())
            .err()
            .expect("missing checkpoint must fail startup");
        assert!(error.contains("checkpoint is missing"), "{error}");
    }

    #[test]
    fn one_writable_path_enforces_only_current_local_day() {
        set_test_clock_day(Some("2026-10-20"));

        let mut entry_today = input("valid-today", "Today is writable");
        entry_today.day = "2026-10-20".into();
        assert!(assert_entry_day_writable(&entry_today).is_ok());

        let mut entry_tomorrow = entry_today.clone();
        entry_tomorrow.day = "2026-10-21".into();
        let err_tomorrow = assert_entry_day_writable(&entry_tomorrow).unwrap_err();
        assert!(err_tomorrow.contains("day 2026-10-21 is not writable"));
        assert!(err_tomorrow.contains("current local day 2026-10-20"));

        let mut entry_yesterday = entry_today.clone();
        entry_yesterday.day = "2026-10-19".into();
        let err_yesterday = assert_entry_day_writable(&entry_yesterday).unwrap_err();
        assert!(err_yesterday.contains("day 2026-10-19 is not writable"));
        assert!(err_yesterday.contains("current local day 2026-10-20"));

        // Rollover: advance clock to 2026-10-21
        set_test_clock_day(Some("2026-10-21"));
        assert!(assert_entry_day_writable(&entry_tomorrow).is_ok());
        let err_old_today = assert_entry_day_writable(&entry_today).unwrap_err();
        assert!(err_old_today.contains("day 2026-10-20 is not writable"));

        set_test_clock_day(None);
    }

    #[test]
    fn fractal_journal_hierarchies_enforces_one_writable_path_per_level() {
        set_test_clock_day(Some("2026-10-20"));

        // 1. All 4 levels succeed on current clock
        let mut day_entry = input("e-day", "Day inscription");
        day_entry.level = Some("day".into());
        day_entry.period = Some("2026-10-20".into());
        day_entry.day = "2026-10-20".into();
        assert!(assert_entry_period_writable(&day_entry).is_ok());

        let mut month_entry = input("e-month", "Month reflection");
        month_entry.level = Some("month".into());
        month_entry.period = Some("2026-10".into());
        month_entry.day = "2026-10-20".into();
        assert!(assert_entry_period_writable(&month_entry).is_ok());

        let mut season_entry = input("e-season", "Season synthesis");
        season_entry.level = Some("season".into());
        season_entry.period = Some("2026-AUTUMN".into());
        season_entry.day = "2026-10-20".into();
        assert!(assert_entry_period_writable(&season_entry).is_ok());

        // Alternate season format "Autumn 2026"
        let mut season_entry_alt = season_entry.clone();
        season_entry_alt.period = Some("Autumn 2026".into());
        assert!(assert_entry_period_writable(&season_entry_alt).is_ok());

        let mut year_entry = input("e-year", "Year inscription");
        year_entry.level = Some("year".into());
        year_entry.period = Some("2026".into());
        year_entry.day = "2026-10-20".into();
        assert!(assert_entry_period_writable(&year_entry).is_ok());

        // 2. Past periods rejected at all levels
        let mut past_day = day_entry.clone();
        past_day.day = "2026-10-19".into();
        past_day.period = Some("2026-10-19".into());
        assert!(assert_entry_period_writable(&past_day).is_err());

        let mut past_month = month_entry.clone();
        past_month.period = Some("2026-09".into());
        assert!(assert_entry_period_writable(&past_month).is_err());

        let mut past_season = season_entry.clone();
        past_season.period = Some("2026-SUMMER".into());
        assert!(assert_entry_period_writable(&past_season).is_err());

        let mut past_year = year_entry.clone();
        past_year.period = Some("2025".into());
        assert!(assert_entry_period_writable(&past_year).is_err());

        // 3. Future periods rejected at all levels
        let mut future_day = day_entry.clone();
        future_day.day = "2026-10-21".into();
        future_day.period = Some("2026-10-21".into());
        assert!(assert_entry_period_writable(&future_day).is_err());

        let mut future_month = month_entry.clone();
        future_month.period = Some("2026-11".into());
        assert!(assert_entry_period_writable(&future_month).is_err());

        let mut future_season = season_entry.clone();
        future_season.period = Some("2026-WINTER".into());
        assert!(assert_entry_period_writable(&future_season).is_err());

        let mut future_year = year_entry.clone();
        future_year.period = Some("2027".into());
        assert!(assert_entry_period_writable(&future_year).is_err());

        // 4. Cross-level smuggling rejected
        let mut smuggle_month_day = month_entry.clone();
        smuggle_month_day.period = Some("2026-10-20".into());
        let err = assert_entry_period_writable(&smuggle_month_day).unwrap_err();
        assert!(err.contains("cross-level smuggling"));

        let mut smuggle_season_day = season_entry.clone();
        smuggle_season_day.period = Some("2026-10-20".into());
        let err = assert_entry_period_writable(&smuggle_season_day).unwrap_err();
        assert!(err.contains("cross-level smuggling"));

        let mut smuggle_year_month = year_entry.clone();
        smuggle_year_month.period = Some("2026-10".into());
        let err = assert_entry_period_writable(&smuggle_year_month).unwrap_err();
        assert!(err.contains("cross-level smuggling"));

        let mut smuggle_day_month = day_entry.clone();
        smuggle_day_month.period = Some("2026-10".into());
        let err = assert_entry_period_writable(&smuggle_day_month).unwrap_err();
        assert!(err.contains("cross-level smuggling"));

        // 5. Verify multi-level append and persistence integrity in JournalState
        let temp = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(temp.path()).unwrap();
        journal.append_entry(day_entry.clone()).unwrap();
        journal.append_entry(month_entry.clone()).unwrap();
        journal.append_entry(season_entry.clone()).unwrap();
        journal.append_entry(year_entry.clone()).unwrap();

        let verification = journal.verification().unwrap();
        assert!(verification.valid);
        assert_eq!(verification.event_count, 4);

        let read = journal.read_entries().unwrap();
        assert_eq!(read.len(), 4);
        assert_eq!(read[0].level.as_deref(), Some("day"));
        assert_eq!(read[1].level.as_deref(), Some("month"));
        assert_eq!(read[2].level.as_deref(), Some("season"));
        assert_eq!(read[3].level.as_deref(), Some("year"));

        set_test_clock_day(None);
    }

    #[test]
    fn acceptance_winter_exceptions_continuous_timeline_and_far_future() {
        // 1. 2026-01-15: Winter 2026 writable; write succeeds
        set_test_clock_day(Some("2026-01-15"));
        assert_eq!(resolve_writable_period("season", 0), "2026-WINTER");
        let mut winter_2026 = input("w1", "Jan winter inscription");
        winter_2026.level = Some("season".into());
        winter_2026.period = Some("2026-WINTER".into());
        winter_2026.day = "2026-01-15".into();
        assert!(assert_entry_period_writable(&winter_2026).is_ok());

        // 2. 2026-03-01: Winter 2026 NOT writable (dormant season rejected); Spring 2026 writable
        set_test_clock_day(Some("2026-03-01"));
        assert_eq!(resolve_writable_period("season", 0), "2026-SPRING");
        winter_2026.day = "2026-03-01".into();
        let err_dormant = assert_entry_period_writable(&winter_2026).unwrap_err();
        assert!(err_dormant.contains("season 2026-WINTER is not writable"));
        let mut spring_2026 = input("s1", "Spring inscription");
        spring_2026.level = Some("season".into());
        spring_2026.period = Some("2026-SPRING".into());
        spring_2026.day = "2026-03-01".into();
        assert!(assert_entry_period_writable(&spring_2026).is_ok());

        // 3. 2026-11-30: Winter 2026 still rejected while clock is Autumn
        set_test_clock_day(Some("2026-11-30"));
        assert_eq!(resolve_writable_period("season", 0), "2026-AUTUMN");
        winter_2026.day = "2026-11-30".into();
        assert!(assert_entry_period_writable(&winter_2026).is_err());

        // 4. 2026-12-01: Winter 2026 writable again, same period key
        set_test_clock_day(Some("2026-12-01"));
        assert_eq!(resolve_writable_period("season", 0), "2026-WINTER");
        winter_2026.day = "2026-12-01".into();
        assert!(assert_entry_period_writable(&winter_2026).is_ok());

        // 5. 2027-01-01: Winter 2026 now permanently sealed; Winter 2027 writable; Year 2026 sealed and Year 2027 writable
        set_test_clock_day(Some("2027-01-01"));
        assert_eq!(resolve_writable_period("season", 0), "2027-WINTER");
        assert_eq!(resolve_writable_period("year", 0), "2027");

        // Winter 2026 rejected
        winter_2026.day = "2027-01-01".into();
        let err_sealed_winter = assert_entry_period_writable(&winter_2026).unwrap_err();
        assert!(err_sealed_winter.contains("season 2026-WINTER is not writable"));

        // Year 2026 rejected
        let mut year_2026 = input("y1", "2026 year inscription");
        year_2026.level = Some("year".into());
        year_2026.period = Some("2026".into());
        year_2026.day = "2027-01-01".into();
        let err_sealed_year = assert_entry_period_writable(&year_2026).unwrap_err();
        assert!(err_sealed_year.contains("year 2026 is not writable"));

        // Winter 2027 & Year 2027 writable
        let mut winter_2027 = input("w2", "Jan 2027 winter inscription");
        winter_2027.level = Some("season".into());
        winter_2027.period = Some("2027-WINTER".into());
        winter_2027.day = "2027-01-01".into();
        assert!(assert_entry_period_writable(&winter_2027).is_ok());

        let mut year_2027 = input("y2", "2027 year inscription");
        year_2027.level = Some("year".into());
        year_2027.period = Some("2027".into());
        year_2027.day = "2027-01-01".into();
        assert!(assert_entry_period_writable(&year_2027).is_ok());

        // 6. Leap check: Feb 29, 2028 is Winter, Mar 1, 2028 is Spring
        set_test_clock_day(Some("2028-02-29"));
        assert_eq!(resolve_writable_period("season", 0), "2028-WINTER");
        set_test_clock_day(Some("2028-03-01"));
        assert_eq!(resolve_writable_period("season", 0), "2028-SPRING");

        // 7. Far-future 2126-10-20
        set_test_clock_day(Some("2126-10-20"));
        assert_eq!(resolve_writable_period("day", 0), "2126-10-20");
        assert_eq!(resolve_writable_period("month", 0), "2126-10");
        assert_eq!(resolve_writable_period("season", 0), "2126-AUTUMN");
        assert_eq!(resolve_writable_period("year", 0), "2126");

        // Write succeeds at each level
        let mut d2126 = input("d-2126", "Day 2126");
        d2126.level = Some("day".into());
        d2126.period = Some("2126-10-20".into());
        d2126.day = "2126-10-20".into();
        assert!(assert_entry_period_writable(&d2126).is_ok());

        let mut m2126 = input("m-2126", "Month 2126");
        m2126.level = Some("month".into());
        m2126.period = Some("2126-10".into());
        m2126.day = "2126-10-20".into();
        assert!(assert_entry_period_writable(&m2126).is_ok());

        let mut s2126 = input("s-2126", "Season 2126");
        s2126.level = Some("season".into());
        s2126.period = Some("2126-AUTUMN".into());
        s2126.day = "2126-10-20".into();
        assert!(assert_entry_period_writable(&s2126).is_ok());

        let mut y2126 = input("y-2126", "Year 2126");
        y2126.level = Some("year".into());
        y2126.period = Some("2126".into());
        y2126.day = "2126-10-20".into();
        assert!(assert_entry_period_writable(&y2126).is_ok());

        // 2125 rejects as sealed
        let mut y2125 = input("y-2125", "Year 2125");
        y2125.level = Some("year".into());
        y2125.period = Some("2125".into());
        y2125.day = "2126-10-20".into();
        assert!(assert_entry_period_writable(&y2125).is_err());

        set_test_clock_day(None);
    }
}
