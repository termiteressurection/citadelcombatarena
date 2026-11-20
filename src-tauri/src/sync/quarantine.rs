use crate::vault::{self, VaultKey};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const AAD_PREFIX: &[u8] = b"citadel-sync-quarantine-v1:";

/// Quarantined peer payloads may contain private journal text, so diagnostics
/// use the same memory-only vault key as every other app-data record.
#[derive(Clone)]
pub struct QuarantineStore {
    dir: PathBuf,
    key: VaultKey,
    write_gate: Arc<Mutex<()>>,
}

impl QuarantineStore {
    pub fn open(dir: &Path, key: &VaultKey) -> Result<Self, String> {
        match fs::symlink_metadata(dir) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                return Err("Quarantine path must be a real directory".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir_all(dir)
                    .map_err(|error| format!("Cannot create quarantine: {error}"))?;
            }
            Err(error) => return Err(format!("Cannot inspect quarantine path: {error}")),
        }
        let store = Self {
            dir: dir.to_path_buf(),
            key: key.clone(),
            write_gate: Arc::new(Mutex::new(())),
        };
        store.encrypt_legacy_files()?;
        Ok(store)
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn write_record(&self, name: &str, bytes: &[u8]) -> Result<(), String> {
        let _guard = self
            .write_gate
            .lock()
            .map_err(|_| "Quarantine lock poisoned".to_string())?;
        self.write_record_locked(name, bytes)
    }

    pub fn append_json_line(&self, name: &str, record: &impl Serialize) -> Result<(), String> {
        let _guard = self
            .write_gate
            .lock()
            .map_err(|_| "Quarantine lock poisoned".to_string())?;
        let path = self.dir.join(name);
        let aad = aad_for(name);
        let mut plaintext = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
                vault::read_encrypted_or_legacy(&path, &self.key, &aad)?.0
            }
            Ok(_) => return Err("Quarantine record must be a regular file".into()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(format!("Cannot inspect quarantine record: {error}")),
        };
        serde_json::to_writer(&mut plaintext, record)
            .map_err(|error| format!("Cannot encode quarantine record: {error}"))?;
        plaintext.push(b'\n');
        vault::write_encrypted(&path, &plaintext, &self.key, &aad)
    }

    pub fn read_record(&self, name: &str) -> Result<Vec<u8>, String> {
        let _guard = self
            .write_gate
            .lock()
            .map_err(|_| "Quarantine lock poisoned".to_string())?;
        let path = self.dir.join(name);
        vault::read_encrypted_or_legacy(&path, &self.key, &aad_for(name)).map(|(bytes, _)| bytes)
    }

    pub fn clear(&self) -> Result<(), String> {
        vault::remove_and_verify(&self.dir)
    }

    fn write_record_locked(&self, name: &str, bytes: &[u8]) -> Result<(), String> {
        validate_record_name(name)?;
        vault::write_encrypted(&self.dir.join(name), bytes, &self.key, &aad_for(name))
    }

    fn encrypt_legacy_files(&self) -> Result<(), String> {
        let entries = fs::read_dir(&self.dir)
            .map_err(|error| format!("Cannot inspect quarantine: {error}"))?;
        for entry in entries {
            let entry =
                entry.map_err(|error| format!("Cannot inspect quarantine entry: {error}"))?;
            let name = entry.file_name().to_string_lossy().into_owned();
            validate_record_name(&name)?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Cannot inspect quarantine entry: {error}"))?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err("Quarantine may contain regular files only".into());
            }
            let (bytes, legacy) =
                vault::read_encrypted_or_legacy(&path, &self.key, &aad_for(&name))?;
            if legacy {
                vault::write_encrypted(&path, &bytes, &self.key, &aad_for(&name))?;
            }
        }
        Ok(())
    }
}

fn validate_record_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name == "." || name == ".." {
        return Err("Invalid quarantine record name".into());
    }
    Ok(())
}

fn aad_for(name: &str) -> Vec<u8> {
    [AAD_PREFIX, name.as_bytes()].concat()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn cit_01_quarantined_peer_text_is_authenticated_encrypted_at_rest() {
        let root = tempdir().unwrap();
        let key = VaultKey::test_key();
        let store = QuarantineStore::open(&root.path().join("quarantine"), &key).unwrap();
        let private_peer_text = b"private incoming journal content";
        store
            .write_record("stone-test.json", private_peer_text)
            .unwrap();
        let encrypted = fs::read(root.path().join("quarantine/stone-test.json")).unwrap();
        assert!(encrypted.starts_with(b"CTVLT001"));
        assert!(!encrypted
            .windows(private_peer_text.len())
            .any(|window| window == private_peer_text));
        assert_eq!(
            store.read_record("stone-test.json").unwrap(),
            private_peer_text
        );
    }
}
