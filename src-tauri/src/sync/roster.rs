use crate::journal_log::{AuthorTrust, JournalState};
use crate::sync::quarantine::QuarantineStore;
use crate::sync::transport::NoiseIdentity;
use crate::vault::{self, VaultKey};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const ROSTER_FILE: &str = "known_devices.json";
const ROSTER_AAD: &[u8] = b"citadel-sync-roster-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KnownDevice {
    pub identity_pubkey: String,
    pub noise_static_pubkey: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDeviceCard {
    pub identity_pubkey: String,
    pub noise_static_pubkey: String,
}

pub struct SyncState {
    sync_dir: PathBuf,
    quarantine: QuarantineStore,
    local_identity_pubkey: String,
    author_trust: AuthorTrust,
    noise_identity: Mutex<NoiseIdentity>,
    vault_key: VaultKey,
    roster: Mutex<BTreeMap<String, KnownDevice>>,
}

impl SyncState {
    pub fn open(
        app_data_dir: &Path,
        journal: &JournalState,
        vault_key: &VaultKey,
    ) -> Result<Self, String> {
        let sync_dir = app_data_dir.join("sync");
        fs::create_dir_all(&sync_dir)
            .map_err(|error| format!("Cannot create sync data directory: {error}"))?;
        let noise_identity = NoiseIdentity::open(&sync_dir, vault_key)?;
        let quarantine = QuarantineStore::open(&app_data_dir.join("quarantine"), vault_key)?;
        let roster_path = sync_dir.join(ROSTER_FILE);
        let roster = if roster_path.exists() {
            let metadata = fs::symlink_metadata(&roster_path)
                .map_err(|error| format!("Cannot inspect known-device roster: {error}"))?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err("Known-device roster must be a regular file".into());
            }
            let (contents, was_legacy) =
                vault::read_encrypted_or_legacy(&roster_path, vault_key, ROSTER_AAD)?;
            let devices: Vec<KnownDevice> = serde_json::from_slice(&contents)
                .map_err(|error| format!("Invalid known-device roster: {error}"))?;
            if was_legacy {
                let map = devices
                    .iter()
                    .cloned()
                    .map(|device| (device.identity_pubkey.clone(), device))
                    .collect::<BTreeMap<_, _>>();
                persist_roster(&roster_path, &map, vault_key)?;
            }
            devices
                .into_iter()
                .map(|device| {
                    validate_key(&device.identity_pubkey)?;
                    validate_key(&device.noise_static_pubkey)?;
                    Ok((device.identity_pubkey.clone(), device))
                })
                .collect::<Result<BTreeMap<_, _>, String>>()?
        } else {
            BTreeMap::new()
        };
        Ok(Self {
            sync_dir,
            quarantine,
            local_identity_pubkey: journal.identity_public_key(),
            author_trust: journal.author_trust(),
            noise_identity: Mutex::new(noise_identity),
            vault_key: vault_key.clone(),
            roster: Mutex::new(roster),
        })
    }

    pub fn local_card(&self) -> Result<LocalDeviceCard, String> {
        Ok(LocalDeviceCard {
            identity_pubkey: self.local_identity_pubkey.clone(),
            noise_static_pubkey: self
                .noise_identity
                .lock()
                .map_err(|_| "Noise identity lock poisoned".to_string())?
                .public_key_hex(),
        })
    }

    pub fn quarantine_dir(&self) -> &Path {
        self.quarantine.dir()
    }

    pub fn quarantine(&self) -> &QuarantineStore {
        &self.quarantine
    }

    pub fn noise_identity(&self) -> Result<NoiseIdentity, String> {
        self.noise_identity
            .lock()
            .map(|identity| identity.clone())
            .map_err(|_| "Noise identity lock poisoned".to_string())
    }

    pub fn known_devices(&self) -> Result<Vec<KnownDevice>, String> {
        self.roster
            .lock()
            .map(|roster| roster.values().cloned().collect())
            .map_err(|_| "Known-device roster lock poisoned".to_string())
    }

    pub fn known_noise_keys(&self) -> Result<Vec<Vec<u8>>, String> {
        self.roster
            .lock()
            .map_err(|_| "Known-device roster lock poisoned".to_string())?
            .values()
            .map(|device| hex::decode(&device.noise_static_pubkey).map_err(|e| e.to_string()))
            .collect()
    }

    pub fn is_known_identity(&self, identity_pubkey: &str) -> Result<bool, String> {
        if identity_pubkey == self.local_identity_pubkey {
            return Ok(true);
        }
        self.roster
            .lock()
            .map(|roster| roster.contains_key(identity_pubkey))
            .map_err(|_| "Known-device roster lock poisoned".to_string())
    }

    pub fn revoke_device(&self, identity_pubkey: &str) -> Result<Vec<KnownDevice>, String> {
        let mut roster = self
            .roster
            .lock()
            .map_err(|_| "Known-device roster lock poisoned".to_string())?;
        if roster.remove(identity_pubkey).is_some() {
            persist_roster(&self.sync_dir.join(ROSTER_FILE), &roster, &self.vault_key)?;
        }
        Ok(roster.values().cloned().collect())
    }

    pub fn matches_remote(&self, identity: &str, noise_static: &[u8]) -> Result<bool, String> {
        let roster = self
            .roster
            .lock()
            .map_err(|_| "Known-device roster lock poisoned".to_string())?;
        Ok(roster
            .get(identity)
            .map(|device| {
                hex::decode(&device.noise_static_pubkey).ok().as_deref() == Some(noise_static)
            })
            .unwrap_or(false))
    }

    pub fn pin_device(
        &self,
        identity_pubkey: String,
        noise_static_pubkey: String,
    ) -> Result<Vec<KnownDevice>, String> {
        validate_key(&identity_pubkey)?;
        validate_key(&noise_static_pubkey)?;
        if identity_pubkey == self.local_identity_pubkey {
            return Err("Cannot add this device to its own known-device roster".into());
        }
        let mut roster = self
            .roster
            .lock()
            .map_err(|_| "Known-device roster lock poisoned".to_string())?;
        if let Some(existing) = roster.get(&identity_pubkey) {
            if existing.noise_static_pubkey != noise_static_pubkey {
                return Err("Pinned identity already maps to a different Noise key".into());
            }
            return Ok(roster.values().cloned().collect());
        }
        let duplicate_noise = roster
            .values()
            .any(|device| device.noise_static_pubkey == noise_static_pubkey);
        if duplicate_noise {
            return Err("Noise static key is already pinned to another identity".into());
        }
        self.author_trust.add(&identity_pubkey)?;
        roster.insert(
            identity_pubkey.clone(),
            KnownDevice {
                identity_pubkey,
                noise_static_pubkey,
            },
        );
        persist_roster(&self.sync_dir.join(ROSTER_FILE), &roster, &self.vault_key)?;
        Ok(roster.values().cloned().collect())
    }

    pub fn clear_all(&self) -> Result<(), String> {
        let mut roster = self
            .roster
            .lock()
            .map_err(|_| "Known-device roster lock poisoned".to_string())?;
        roster.clear();
        let roster_path = self.sync_dir.join(ROSTER_FILE);
        vault::remove_and_verify(&roster_path)?;
        self.author_trust
            .reset_to_local(&self.local_identity_pubkey)?;
        self.quarantine.clear()?;
        let noise_key_path = self.sync_dir.join("noise_x25519.keypair");
        vault::remove_and_verify(&noise_key_path)?;
        let replacement = NoiseIdentity::open(&self.sync_dir, &self.vault_key)?;
        *self
            .noise_identity
            .lock()
            .map_err(|_| "Noise identity lock poisoned".to_string())? = replacement;
        Ok(())
    }
}

fn validate_key(key: &str) -> Result<(), String> {
    let bytes =
        hex::decode(key).map_err(|_| "Pinned public key must be hexadecimal".to_string())?;
    if bytes.len() != 32 {
        return Err("Pinned public key must be exactly 32 bytes".into());
    }
    Ok(())
}

fn persist_roster(
    path: &Path,
    roster: &BTreeMap<String, KnownDevice>,
    key: &VaultKey,
) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(&roster.values().collect::<Vec<_>>())
        .map_err(|error| format!("Cannot encode known-device roster: {error}"))?;
    vault::write_encrypted(path, &bytes, key, ROSTER_AAD)
}

#[cfg(test)]
mod security_tests {
    use super::*;
    use crate::journal_log::JournalState;
    use tempfile::tempdir;

    #[test]
    fn cit_06_wipe_rotates_encrypted_noise_identity_but_retains_device_identity() {
        let root = tempdir().unwrap();
        let key = VaultKey::test_key();
        let journal = JournalState::open_with_key(root.path(), &key).unwrap();
        let remote_identity = "11".repeat(32);
        let device_key_before = fs::read(root.path().join("device.ed25519")).unwrap();
        let sync = SyncState::open(root.path(), &journal, &key).unwrap();
        sync.pin_device(remote_identity.clone(), "22".repeat(32))
            .unwrap();
        let encrypted_roster = fs::read(root.path().join("sync/known_devices.json")).unwrap();
        assert!(encrypted_roster.starts_with(b"CTVLT001"));
        assert!(!encrypted_roster
            .windows(8)
            .any(|window| window == b"11111111"));
        let noise_before = sync.local_card().unwrap().noise_static_pubkey;

        sync.clear_all().unwrap();

        let noise_after = sync.local_card().unwrap().noise_static_pubkey;
        assert_ne!(
            noise_before, noise_after,
            "wipe must revoke the prior Noise identity"
        );
        assert!(root.path().join("sync/noise_x25519.keypair").is_file());
        assert!(fs::read(root.path().join("sync/noise_x25519.keypair"))
            .unwrap()
            .starts_with(b"CTVLT001"));
        assert_eq!(
            fs::read(root.path().join("device.ed25519")).unwrap(),
            device_key_before
        );
        assert!(!journal.author_trust().contains(&remote_identity).unwrap());
    }
}

#[tauri::command]
pub fn sync_local_identity(
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<LocalDeviceCard, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let sync = &services.sync;
    sync.local_card()
}

#[tauri::command]
pub fn sync_known_devices(
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<Vec<KnownDevice>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let sync = &services.sync;
    sync.known_devices()
}

/// Pairing remains parked because it cannot be tested without two real devices.
/// Reopen only after an end-to-end two-device ceremony test passes.
#[tauri::command]
pub fn sync_pin_known_device(
    identity_pubkey: String,
    noise_static_pubkey: String,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<Vec<KnownDevice>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let sync = &services.sync;
    sync.pin_device(identity_pubkey, noise_static_pubkey)
}

#[tauri::command]
pub fn sync_revoke_known_device(
    identity_pubkey: String,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<Vec<KnownDevice>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let sync = &services.sync;
    sync.revoke_device(&identity_pubkey)
}
