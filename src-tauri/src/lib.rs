use std::env;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::RwLock;
use std::sync::{Mutex, MutexGuard};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub mod generative_engine;
pub mod graph;
pub mod journal_log;
mod journal_migration;
mod pattern_engine;
pub mod semantic_engine;
pub mod sync;
pub mod trismegistus;
pub mod trmgts_import;
pub mod vault;
pub mod vault_storage;

/// Serializes durable reads/retrieval with a destructive wipe. A command that
/// began before the wipe completes first; commands queued behind it see empty stores.
pub static APP_DATA_GATE: RwLock<()> = RwLock::new(());

pub struct VaultRuntime {
    root: PathBuf,
    key: Mutex<Option<vault::VaultKey>>,
    services: Mutex<Option<DataServices>>,
}

pub(crate) struct DataServices {
    pub(crate) journal: journal_log::JournalState,
    pub(crate) graph: graph::GraphState,
    pub(crate) semantic: semantic_engine::SemanticState,
    pub(crate) sync: sync::roster::SyncState,
}

impl VaultRuntime {
    pub(crate) fn data(&self) -> Result<MutexGuard<'_, Option<DataServices>>, String> {
        self.services
            .lock()
            .map_err(|_| "Vault services lock poisoned".to_string())
    }

    pub(crate) fn key(&self) -> Result<vault::VaultKey, String> {
        self.key
            .lock()
            .map_err(|_| "Vault state lock poisoned".to_string())?
            .clone()
            .ok_or_else(|| "Vault is locked".to_string())
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultStatus {
    initialized: bool,
}

#[tauri::command]
fn vault_status(vault: tauri::State<'_, VaultRuntime>) -> VaultStatus {
    VaultStatus {
        initialized: vault.root.join("vault.header").is_file(),
    }
}

#[tauri::command]
fn vault_unlock(
    app: tauri::AppHandle,
    vault: tauri::State<'_, VaultRuntime>,
    mut passphrase: String,
) -> Result<(), String> {
    let result = (|| {
        let _gate = APP_DATA_GATE
            .write()
            .map_err(|_| "Wipe gate poisoned".to_string())?;
        let mut services_slot = vault.data()?;
        if services_slot.is_some() {
            return Ok(());
        }
        let key = if passphrase.is_empty() {
            vault::get_or_create_device_key(&vault.root)?
        } else {
            vault::initialize_or_unlock(&vault.root, &passphrase)
                .or_else(|_| vault::get_or_create_device_key(&vault.root))?
        };
        let _ = migrate_portable_user_stores(&key);
        let services = unlock_data_services(&app, &vault.root, &key)?;
        let mut held = vault
            .key
            .lock()
            .map_err(|_| "Vault state lock poisoned".to_string())?;
        *held = Some(key);
        *services_slot = Some(services);
        Ok(())
    })();
    use zeroize::Zeroize;
    passphrase.zeroize();
    result
}

#[tauri::command]
fn vault_lock(_vault: tauri::State<'_, VaultRuntime>) -> Result<(), String> {
    // Passcode lock removed: keep data services accessible without locking out the user
    Ok(())
}

#[tauri::command]
fn generative_get_status(
    generative: tauri::State<'_, std::sync::Arc<generative_engine::GenerativeManager>>,
) -> generative_engine::GenerativeStatus {
    generative.status()
}

#[tauri::command]
fn generative_synthesize_voice(
    app: tauri::AppHandle,
    generative: tauri::State<'_, std::sync::Arc<generative_engine::GenerativeManager>>,
    prompt: String,
    max_tokens: Option<usize>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    generative.generate_stream(app, prompt, max_tokens, temperature)
}

#[tauri::command]
fn vault_storage_read(
    runtime: tauri::State<'_, VaultRuntime>,
) -> Result<vault_storage::WebviewStorage, String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let key = runtime.key()?;
    vault_storage::load(&runtime.root, &key)
}

#[tauri::command]
fn vault_storage_replace(
    runtime: tauri::State<'_, VaultRuntime>,
    values: vault_storage::WebviewStorage,
) -> Result<(), String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let key = runtime.key()?;
    vault_storage::save(&runtime.root, &key, &values)
}

#[tauri::command]
fn vault_storage_clear(runtime: tauri::State<'_, VaultRuntime>) -> Result<(), String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let _key = runtime.key()?;
    vault_storage::clear(&runtime.root)
}

fn unlock_data_services(
    app: &tauri::AppHandle,
    app_data_dir: &Path,
    key: &vault::VaultKey,
) -> Result<DataServices, String> {
    // Remove the former unpinned download slot before any data services start.
    remove_unpinned_model_slot(app_data_dir)?;
    let journal = journal_log::JournalState::open_with_key(app_data_dir, key)?;
    journal_migration::migrate_app_data(&journal)?;

    let graph_dir = app_data_dir.join("citadel_graph");
    let graph = graph::open(&graph_dir, key)?;
    let events = journal.verified_events()?;
    let projection = events
        .iter()
        .map(|event| graph::GraphEntryInput {
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
        })
        .collect::<Vec<_>>();
    graph::rebuild_projection(&graph, &projection)?;

    let model_dir = "models/all-MiniLM-L6-v2";
    let bundled_model = app
        .path()
        .resolve(
            format!("{model_dir}/model_quantized.onnx"),
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .filter(|path| path.is_file())
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(model_dir)
                .join("model_quantized.onnx")
        });
    let bundled_vocab = app
        .path()
        .resolve(
            format!("{model_dir}/vocab.txt"),
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .filter(|path| path.is_file())
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(model_dir)
                .join("vocab.txt")
        });
    let semantic = semantic_engine::SemanticState::open(
        app_data_dir,
        &bundled_model,
        &bundled_vocab,
        &events,
        key,
    );
    let sync = sync::roster::SyncState::open(app_data_dir, &journal, key)?;

    Ok(DataServices {
        journal,
        graph,
        semantic,
        sync,
    })
}

fn remove_unpinned_model_slot(app_data_dir: &Path) -> Result<(), String> {
    vault::remove_and_verify(&app_data_dir.join("models/generative"))
}

#[derive(serde::Serialize)]
struct PortableModeInfo {
    enabled: bool,
    root_dir: Option<String>,
}

fn portable_root_dir() -> Option<PathBuf> {
    let root = env::var_os("CITADEL_REPO_LOCAL_DIR")?;
    let path = PathBuf::from(root);
    if path.as_os_str().is_empty() {
        return None;
    }
    if path.is_absolute() {
        Some(path)
    } else {
        env::current_dir().ok().map(|cwd| cwd.join(path))
    }
}

fn canonical_portable_root() -> Result<Option<PathBuf>, String> {
    let Some(root) = portable_root_dir() else {
        return Ok(None);
    };
    if !root.exists() {
        fs::create_dir_all(&root)
            .map_err(|error| format!("Cannot create portable root: {error}"))?;
    }
    let metadata = fs::symlink_metadata(&root)
        .map_err(|error| format!("Cannot inspect portable root {}: {error}", root.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Portable root must be a real directory, not a symlink".into());
    }
    let canonical = fs::canonicalize(&root)
        .map_err(|error| format!("Cannot canonicalize portable root: {error}"))?;
    Ok(Some(canonical))
}

fn resolve_under_portable_root(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative_path);
    if relative.is_absolute() {
        return Err("Portable paths must be relative".to_string());
    }
    let components = relative.components().collect::<Vec<_>>();
    if components.is_empty() {
        return Err("Portable path cannot name the root directory".into());
    }
    let mut candidate = root.to_path_buf();
    for (index, component) in components.iter().enumerate() {
        match component {
            Component::Normal(part) => candidate.push(part),
            Component::CurDir => continue,
            _ => return Err("Portable paths cannot escape the canonical root".to_string()),
        }
        match fs::symlink_metadata(&candidate) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(format!(
                        "Portable path crosses a symlink: {}",
                        candidate.display()
                    ));
                }
                let canonical = fs::canonicalize(&candidate)
                    .map_err(|error| format!("Cannot canonicalize portable path: {error}"))?;
                if !canonical.starts_with(root) {
                    return Err("Portable path resolves outside the canonical root".into());
                }
                if index + 1 < components.len() && !metadata.is_dir() {
                    return Err("Portable path has a non-directory parent".into());
                }
                candidate = canonical;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                // All remaining components are lexical normal components; any parent is
                // revalidated after it is created and before the file is opened.
                for remaining in components.iter().skip(index + 1) {
                    match remaining {
                        Component::Normal(part) => candidate.push(part),
                        Component::CurDir => {}
                        _ => return Err("Portable paths cannot escape the canonical root".into()),
                    }
                }
                return Ok(candidate);
            }
            Err(error) => return Err(format!("Cannot inspect portable path: {error}")),
        }
    }
    Ok(candidate)
}

fn resolve_portable_relative(relative_path: &str) -> Result<PathBuf, String> {
    let root =
        canonical_portable_root()?.ok_or_else(|| "Portable mode is not enabled".to_string())?;
    resolve_under_portable_root(&root, relative_path)
}

const PORTABLE_DATA_AAD: &[u8] = b"citadel-portable-user-data-v1";
const MAX_PORTABLE_PLAINTEXT_BYTES: u64 = 64 * 1024 * 1024;
const MAX_PORTABLE_ENVELOPE_BYTES: u64 = 86 * 1024 * 1024;

fn validate_portable_read_size(size: u64, encrypted_user_data: bool) -> Result<(), String> {
    let limit = if encrypted_user_data {
        MAX_PORTABLE_ENVELOPE_BYTES
    } else {
        MAX_PORTABLE_PLAINTEXT_BYTES
    };
    if size > limit {
        return Err(format!("Portable file exceeds the {limit}-byte read limit"));
    }
    Ok(())
}

fn is_portable_user_data(relative_path: &str) -> bool {
    let mut components = Path::new(relative_path).components();
    matches!(components.next(), Some(Component::Normal(first)) if first == "citadel-runtime")
        && matches!(components.next(), Some(Component::Normal(second)) if second == "world" || second == "prefs")
}

fn read_portable_user_data(path: &Path, key: &vault::VaultKey) -> Result<String, String> {
    let (bytes, was_legacy) = vault::read_encrypted_or_legacy(path, key, PORTABLE_DATA_AAD)?;
    if was_legacy {
        vault::write_encrypted(path, &bytes, key, PORTABLE_DATA_AAD)?;
    }
    String::from_utf8(bytes).map_err(|error| format!("Portable user data is not UTF-8: {error}"))
}

fn write_portable_user_data(
    path: &Path,
    contents: &[u8],
    key: &vault::VaultKey,
) -> Result<(), String> {
    vault::write_encrypted(path, contents, key, PORTABLE_DATA_AAD)
}

fn migrate_portable_user_stores(key: &vault::VaultKey) -> Result<(), String> {
    let Some(root) = canonical_portable_root()? else {
        return Ok(());
    };
    for relative in ["citadel-runtime/world", "citadel-runtime/prefs"] {
        migrate_portable_directory(&root.join(relative), key)?;
    }
    Ok(())
}

fn migrate_portable_directory(path: &Path, key: &vault::VaultKey) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Cannot inspect portable data directory: {error}")),
        Ok(metadata) => metadata,
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "Portable data directory must be a real directory: {}",
            path.display()
        ));
    }
    for entry in
        fs::read_dir(path).map_err(|error| format!("Cannot enumerate portable data: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Cannot inspect portable data entry: {error}"))?;
        let child = entry.path();
        let child_metadata = fs::symlink_metadata(&child)
            .map_err(|error| format!("Cannot inspect portable data entry: {error}"))?;
        if child_metadata.file_type().is_symlink() {
            return Err(format!(
                "Portable data cannot contain symlinks: {}",
                child.display()
            ));
        }
        if child_metadata.is_dir() {
            migrate_portable_directory(&child, key)?;
        } else if child_metadata.is_file() {
            if child_metadata.len() > 64 * 1024 * 1024 {
                return Err(format!(
                    "Portable user data exceeds 64 MiB: {}",
                    child.display()
                ));
            }
            let (bytes, legacy) = vault::read_encrypted_or_legacy(&child, key, PORTABLE_DATA_AAD)?;
            if legacy {
                vault::write_encrypted(&child, &bytes, key, PORTABLE_DATA_AAD)?;
            }
        }
    }
    Ok(())
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn portable_mode_info() -> PortableModeInfo {
    let root_dir = canonical_portable_root()
        .ok()
        .flatten()
        .map(|path| path.to_string_lossy().to_string());
    PortableModeInfo {
        enabled: root_dir.is_some(),
        root_dir,
    }
}

#[tauri::command]
fn portable_read_text(
    runtime: tauri::State<'_, VaultRuntime>,
    relative_path: String,
) -> Result<Option<String>, String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let path = resolve_portable_relative(&relative_path)?;
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Cannot inspect portable file: {error}")),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            return Err("Portable read target must be a regular file".into());
        }
        Ok(metadata) => validate_portable_read_size(
            metadata.len(),
            is_portable_user_data(&relative_path),
        )?,
    }
    let checked_path = resolve_portable_relative(&relative_path)?;
    if checked_path != path {
        return Err("Portable path changed during validation".into());
    }
    if is_portable_user_data(&relative_path) {
        let key = runtime.key()?;
        let checked_path = resolve_portable_relative(&relative_path)?;
        if checked_path != path {
            return Err("Portable path changed during encrypted migration".into());
        }
        return read_portable_user_data(&path, &key).map(Some);
    }
    fs::read_to_string(path)
        .map(Some)
        .map_err(|err| err.to_string())
}

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(1);

fn unique_temp_path(target: &Path) -> PathBuf {
    let parent = target.parent().unwrap_or_else(|| Path::new("."));
    let file_name = target
        .file_name()
        .map(|s| s.to_string_lossy())
        .unwrap_or_else(|| "citadel".into());
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    let counter = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    parent.join(format!(".{}.{}_{}_{}.tmp", file_name, pid, now, counter))
}

fn atomic_write_file(relative_path: &str, data: &[u8]) -> Result<(), String> {
    let path = resolve_portable_relative(relative_path)?;
    ensure_parent_dir(&path)?;
    let path = resolve_portable_relative(relative_path)?;
    let tmp = unique_temp_path(&path);
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&tmp)
        .map_err(|error| format!("Failed creating temp file {}: {error}", tmp.display()))?;
    file.write_all(data)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Failed writing temp file {}: {error}", tmp.display()))?;
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!(
            "Failed atomically renaming {} to {}: {}",
            tmp.display(),
            path.display(),
            e
        )
    })
}

#[tauri::command]
fn portable_write_text(
    runtime: tauri::State<'_, VaultRuntime>,
    relative_path: String,
    contents: String,
) -> Result<(), String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    if is_portable_user_data(&relative_path) {
        let path = resolve_portable_relative(&relative_path)?;
        let checked_path = resolve_portable_relative(&relative_path)?;
        if checked_path != path {
            return Err("Portable path changed during encrypted write".into());
        }
        return write_portable_user_data(&path, contents.as_bytes(), &runtime.key()?);
    }
    atomic_write_file(&relative_path, contents.as_bytes())
}

#[tauri::command]
fn portable_write_bytes(
    runtime: tauri::State<'_, VaultRuntime>,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    if is_portable_user_data(&relative_path) {
        let path = resolve_portable_relative(&relative_path)?;
        let checked_path = resolve_portable_relative(&relative_path)?;
        if checked_path != path {
            return Err("Portable path changed during encrypted write".into());
        }
        return write_portable_user_data(&path, &bytes, &runtime.key()?);
    }
    atomic_write_file(&relative_path, &bytes)
}

#[tauri::command]
fn portable_remove_file(relative_path: String) -> Result<(), String> {
    let _gate = APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let path = resolve_portable_relative(&relative_path)?;
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Cannot inspect portable removal target: {error}")),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            return Err("Portable removal target must be a regular file".into());
        }
        Ok(_) => {}
    }
    let checked_path = resolve_portable_relative(&relative_path)?;
    if checked_path != path {
        return Err("Portable removal path changed during validation".into());
    }
    fs::remove_file(&path).map_err(|err| err.to_string())?;
    match fs::symlink_metadata(&path) {
        Ok(_) => {
            return Err(format!(
                "Portable deletion verification failed: {} remains",
                path.display()
            ))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "Cannot verify portable deletion of {}: {error}",
                path.display()
            ))
        }
    }
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWipeReport {
    pub cleared_paths: Vec<String>,
    pub survivors: Vec<String>,
}

#[tauri::command]
fn citadel_full_wipe(runtime: tauri::State<'_, VaultRuntime>) -> Result<NativeWipeReport, String> {
    let _wipe_guard = APP_DATA_GATE
        .write()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let portable_root = if portable_root_dir().is_some() {
        canonical_portable_root()?
    } else {
        None
    };
    wipe_unlocked_stores(
        &services.journal,
        &services.graph,
        &services.semantic,
        &services.sync,
        portable_root.as_deref(),
    )
}

pub(crate) fn wipe_unlocked_stores(
    journal: &journal_log::JournalState,
    graph: &graph::GraphState,
    semantic: &semantic_engine::SemanticState,
    sync: &sync::roster::SyncState,
    portable_root: Option<&Path>,
) -> Result<NativeWipeReport, String> {
    let mut cleared_paths = Vec::new();
    let root = journal.root();

    journal.reset_all()?;
    cleared_paths.push("tauri:app_data/journal.log".to_string());

    let migration_cleared = journal_migration::wipe_migration_and_profile(journal.root())?;
    cleared_paths.extend(migration_cleared);

    graph::clear_graph(&graph)?;
    cleared_paths.push("tauri:app_data/citadel_graph/".to_string());

    semantic.clear_index()?;
    cleared_paths.push("tauri:app_data/semantic_index/index.json".to_string());

    sync.clear_all()?;
    cleared_paths.push("tauri:app_data/sync/known_devices.json".to_string());
    cleared_paths
        .push("tauri:app_data/sync/noise_x25519.keypair (deleted and regenerated)".to_string());
    cleared_paths.push("tauri:app_data/quarantine/".to_string());

    vault_storage::clear(root)?;
    cleared_paths.push("tauri:app_data/webview_storage.json".to_string());

    let old_model_dir = root.join("models/generative");
    vault::remove_and_verify(&old_model_dir)?;
    cleared_paths.push("tauri:app_data/models/generative/".to_string());

    if let Some(portable_root) = portable_root {
        for rel in ["world", "prefs"] {
            let dir = portable_root.join(rel);
            vault::remove_and_verify(&dir)?;
            cleared_paths.push(format!("portable:citadel-runtime/{rel}/"));
        }
    }

    let mut survivors = Vec::new();
    for check in [
        "journal.log",
        "journal.head",
        "citadel-profile.json",
        "migration_receipt.json",
        "legacy_storage_backup",
        "citadel-state.json",
        "state.json",
        "citadel_graph",
        "semantic_index/index.json",
        "semantic_index",
        "sync/known_devices.json",
        "citadel_graph.enc",
        "models/generative",
        "quarantine",
        "webview_storage.json",
    ] {
        match fs::symlink_metadata(root.join(check)) {
            Ok(_) => survivors.push(format!("tauri:app_data/{check}:physical-residual")),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => survivors.push(format!(
                "tauri:app_data/{check}:verification-failed:{error}"
            )),
        }
    }
    if !journal.verified_events()?.is_empty() {
        survivors.push("tauri:memory/journal_events".to_string());
    }
    if !graph::is_empty(&graph)? {
        survivors.push("tauri:app_data/citadel_graph/".to_string());
    }
    for retained_encrypted in ["device.ed25519", "sync/noise_x25519.keypair"] {
        match fs::read(root.join(retained_encrypted)) {
            Ok(bytes) if bytes.starts_with(b"CTVLT001") => {}
            Ok(_) => survivors.push(format!(
                "tauri:app_data/{retained_encrypted}:plaintext-or-invalid"
            )),
            Err(error) => survivors.push(format!(
                "tauri:app_data/{retained_encrypted}:verification-failed:{error}"
            )),
        }
    }

    Ok(NativeWipeReport {
        cleared_paths,
        survivors,
    })
}

/// Bring the Citadel window to front and focus the app.
/// Triggered by the global hotkey CMD+K (per CITADEL_NATIVE_SPEC.md).
fn summon_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // GGML Metal residency sets cause SIGABRT on application quit (Cmd+Q) if Metal
    // buffers remain tracked during C runtime static destructors (__cxa_finalize_ranges).
    // Setting GGML_METAL_NO_RESIDENCY avoids the residency assert trap while keeping
    // full Metal GPU acceleration active.
    std::env::set_var("GGML_METAL_NO_RESIDENCY", "1");

    tauri::Builder::default()
        // File system access for ~/Library/Application Support/Citadel/
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // Path resolution via @tauri-apps/api
        // Global shortcut: CMD+K = The Global Summon
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            vault_status,
            vault_unlock,
            vault_lock,
            vault_storage_read,
            vault_storage_replace,
            vault_storage_clear,
            portable_mode_info,
            portable_read_text,
            portable_write_text,
            portable_write_bytes,
            portable_remove_file,
            citadel_full_wipe,
            journal_log::journal_append_entry,
            journal_log::journal_read_entries,
            journal_log::journal_verify,
            journal_log::journal_crystallize_day,
            journal_log::journal_get_day_status,
            journal_migration::journal_migrate_browser_snapshot,
            journal_migration::journal_read_profile,
            journal_migration::journal_save_profile,
            journal_migration::journal_migration_receipt,
            graph::graph_query,
            semantic_engine::semantic_search,
            semantic_engine::rebuild_semantic_index,
            semantic_engine::get_semantic_status,
            semantic_engine::semantic_pair_scores,
            pattern_engine::get_patterns_for_horizon,
            pattern_engine::get_entity_patterns,
            sync::roster::sync_local_identity,
            sync::roster::sync_known_devices,
            sync::roster::sync_revoke_known_device,
            sync::sync_export_stone_bundle,
            sync::sync_import_stone_bundle,
            trmgts_import::trmgts_start_session,
            trmgts_import::trmgts_end_session,
            trmgts_import::trmgts_preview_pending,
            trmgts_import::trmgts_preview_file,
            trmgts_import::trmgts_discard_preview,
            trmgts_import::trmgts_accept_import,
            generative_get_status,
            generative_synthesize_voice,
            // Pairing is parked: no two-device test setup exists. Keep peer-key
            // pinning, phrase confirmation, connect and accept commands unreachable
            // until an end-to-end pairing ceremony passes with two real devices.
        ])
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;

            // Auto-unlock data services on app boot with the transparent device key.
            // Eliminates the passcode barrier and lock screen entirely.
            let key = vault::get_or_create_device_key(&app_data_dir)?;
            let _ = migrate_portable_user_stores(&key);
            let services = unlock_data_services(&app.handle(), &app_data_dir, &key)?;

            app.manage(VaultRuntime {
                root: app_data_dir,
                key: Mutex::new(Some(key)),
                services: Mutex::new(Some(services)),
            });
            app.manage(trmgts_import::ImportRuntime::default());
            let generative_mgr =
                std::sync::Arc::new(generative_engine::GenerativeManager::new(&app.handle()));
            generative_engine::register_exit_teardown(&generative_mgr);
            app.manage(generative_mgr);
            let handle = app.handle().clone();

            // Register CMD+K global hotkey when the current desktop accepts it.
            // Some Linux compositors reserve or reject global shortcuts; that
            // should not prevent the notebook from launching.
            #[cfg(target_os = "macos")]
            let shortcut = Shortcut::new(Some(Modifiers::META), Code::KeyK);
            #[cfg(not(target_os = "macos"))]
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyK);

            if let Err(err) =
                app.global_shortcut()
                    .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                        summon_window(&handle);
                    })
            {
                eprintln!("[citadel] global shortcut unavailable: {err}");
            }

            // macOS: enable vibrancy on the main window when available.
            // Monterey support should degrade to a normal transparent window
            // instead of panicking during startup.
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                if let Some(window) = app.get_webview_window("main") {
                    #[cfg(all(debug_assertions, feature = "devtools"))]
                    window.open_devtools();
                    if let Err(err) =
                        apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                    {
                        eprintln!("[citadel] macOS vibrancy unavailable: {err}");
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Citadel")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                if let Some(mgr) = app_handle.try_state::<std::sync::Arc<generative_engine::GenerativeManager>>() {
                    mgr.unload();
                }
            }
        });
}

#[cfg(test)]
mod security_regression_tests {
    use super::*;

    #[test]
    fn cit_09_portable_paths_reject_parent_traversal_and_symlink_escape() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("citadel-runtime/world")).unwrap();
        fs::write(outside.path().join("secret.json"), b"outside").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(
            outside.path(),
            root.path().join("citadel-runtime/world/link"),
        )
        .unwrap();

        let canonical_root = fs::canonicalize(root.path()).unwrap();
        assert!(resolve_under_portable_root(&canonical_root, "../outside/file").is_err());
        assert!(resolve_under_portable_root(
            &canonical_root,
            "citadel-runtime/world/link/secret.json"
        )
        .is_err());
        let safe =
            resolve_under_portable_root(&canonical_root, "citadel-runtime/world/saves/new.json")
                .unwrap();
        assert!(safe.starts_with(&canonical_root));
    }

    #[test]
    fn cit_10_portable_import_size_is_checked_before_file_read() {
        assert!(validate_portable_read_size(MAX_PORTABLE_PLAINTEXT_BYTES, false).is_ok());
        assert!(validate_portable_read_size(MAX_PORTABLE_PLAINTEXT_BYTES + 1, false).is_err());
        assert!(validate_portable_read_size(MAX_PORTABLE_ENVELOPE_BYTES, true).is_ok());
        assert!(validate_portable_read_size(MAX_PORTABLE_ENVELOPE_BYTES + 1, true).is_err());
    }

    #[test]
    fn cit_05_portable_removal_reports_filesystem_query_failure() {
        let root = tempfile::tempdir().unwrap();
        let blocker = root.path().join("not-a-directory");
        fs::write(&blocker, b"blocker").unwrap();
        let nested = blocker.join("child");
        assert!(vault::remove_and_verify(&nested).is_err());
        assert!(blocker.is_file());
    }

    #[test]
    fn cit_01_portable_user_records_are_encrypted_and_legacy_files_migrate() {
        let root = tempfile::tempdir().unwrap();
        let path = root
            .path()
            .join("citadel-runtime/world/saves/citadel-main.json");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, br#"{"memory":"private portable thought"}"#).unwrap();
        let key = vault::VaultKey::test_key();

        let contents = read_portable_user_data(&path, &key).unwrap();

        assert!(contents.contains("private portable thought"));
        let disk = fs::read(&path).unwrap();
        assert!(disk.starts_with(b"CTVLT001"));
        assert!(!disk
            .windows(b"private portable thought".len())
            .any(|part| part == b"private portable thought"));
        write_portable_user_data(&path, b"new private preference", &key).unwrap();
        assert!(fs::read(&path).unwrap().starts_with(b"CTVLT001"));
    }

    #[test]
    fn cit_11_unlock_removes_legacy_unpinned_model_bytes() {
        let root = tempfile::tempdir().unwrap();
        let legacy_model = root.path().join("models/generative/model.gguf");
        fs::create_dir_all(legacy_model.parent().unwrap()).unwrap();
        fs::write(&legacy_model, b"unverified model payload").unwrap();

        remove_unpinned_model_slot(root.path()).unwrap();

        assert!(fs::symlink_metadata(root.path().join("models/generative")).is_err());
    }

    #[test]
    fn cit_13_release_csp_has_no_network_source_and_dev_csp_is_localhost_only() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let security = &config["app"]["security"];
        let release_csp = security["csp"].as_str().unwrap();
        let dev_csp = security["devCsp"].as_str().unwrap();
        assert!(release_csp.contains("connect-src ipc: http://ipc.localhost"));
        assert!(!release_csp.contains("localhost:5173"));
        assert!(!release_csp.contains("https:"));
        assert!(dev_csp.contains("http://localhost:5173"));
        assert!(dev_csp.contains("ws://localhost:5173"));
        assert!(release_csp.contains("script-src 'self'"));
        assert!(!release_csp.contains("unsafe-eval"));
        assert!(release_csp.contains("frame-src 'none'"));

        let capabilities: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/main.json")).unwrap();
        let permissions = capabilities["permissions"].as_array().unwrap();
        assert!(!permissions
            .iter()
            .any(|permission| permission.as_str() == Some("shell:default")));
        for permission in permissions {
            if let Some(permission) = permission.as_object() {
                assert!(permission["allow"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .all(|scope| { scope["path"].as_str().unwrap().starts_with("$APPDATA/") }));
            }
        }
    }
}
