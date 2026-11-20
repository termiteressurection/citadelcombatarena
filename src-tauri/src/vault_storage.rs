use crate::vault::{self, VaultKey};
use std::collections::BTreeMap;
use std::path::Path;

const STORAGE_FILE: &str = "webview_storage.json";
const STORAGE_AAD: &[u8] = b"citadel-webview-storage-v1";
const MAX_STORAGE_BYTES: usize = 32 * 1024 * 1024;
const MAX_STORAGE_KEYS: usize = 512;
const MAX_STORAGE_KEY_BYTES: usize = 256;
const MAX_STORAGE_VALUE_BYTES: usize = 8 * 1024 * 1024;

pub type WebviewStorage = BTreeMap<String, String>;

pub(crate) fn load(root: &Path, key: &VaultKey) -> Result<WebviewStorage, String> {
    let path = root.join(STORAGE_FILE);
    if !path.exists() {
        return Ok(BTreeMap::new());
    }
    let (bytes, legacy) = vault::read_encrypted_or_legacy(&path, key, STORAGE_AAD)?;
    if bytes.len() > MAX_STORAGE_BYTES {
        return Err("Encrypted WebView storage exceeds the 32 MiB limit".into());
    }
    let values: WebviewStorage = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid encrypted WebView storage: {error}"))?;
    validate(&values)?;
    if legacy {
        save(root, key, &values)?;
    }
    Ok(values)
}

pub(crate) fn save(root: &Path, key: &VaultKey, values: &WebviewStorage) -> Result<(), String> {
    validate(values)?;
    let bytes = serde_json::to_vec(values)
        .map_err(|error| format!("Cannot encode WebView storage: {error}"))?;
    if bytes.len() > MAX_STORAGE_BYTES {
        return Err("WebView storage exceeds the 32 MiB limit".into());
    }
    vault::write_encrypted(&root.join(STORAGE_FILE), &bytes, key, STORAGE_AAD)
}

pub(crate) fn clear(root: &Path) -> Result<(), String> {
    vault::remove_and_verify(&root.join(STORAGE_FILE))
}

fn validate(values: &WebviewStorage) -> Result<(), String> {
    if values.len() > MAX_STORAGE_KEYS {
        return Err(format!(
            "WebView storage exceeds the {MAX_STORAGE_KEYS}-key limit"
        ));
    }
    for (name, value) in values {
        if name.is_empty() || name.len() > MAX_STORAGE_KEY_BYTES {
            return Err(format!(
                "WebView storage key must be 1–{MAX_STORAGE_KEY_BYTES} bytes"
            ));
        }
        if value.len() > MAX_STORAGE_VALUE_BYTES {
            return Err(format!(
                "WebView storage value for {name} exceeds the 8 MiB limit"
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn cit_01_webview_storage_is_encrypted_and_authenticated_at_rest() {
        let root = tempfile::tempdir().unwrap();
        let key = VaultKey::test_key();
        let mut values = WebviewStorage::new();
        values.insert(
            "citadel_sigma_chat_archives".into(),
            "private recollection".into(),
        );

        save(root.path(), &key, &values).unwrap();

        let bytes = fs::read(root.path().join(STORAGE_FILE)).unwrap();
        assert!(bytes.starts_with(b"CTVLT001"));
        assert!(!bytes
            .windows(b"private recollection".len())
            .any(|part| part == b"private recollection"));
        assert_eq!(load(root.path(), &key).unwrap(), values);
    }
}
