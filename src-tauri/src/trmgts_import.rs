use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use pbkdf2::pbkdf2_hmac;
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fmt;
use std::fs;
use std::io::{BufReader, Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use zeroize::{Zeroize, Zeroizing};

const FORMAT: &str = "trismegistus";
const ALGORITHM: &str = "PBKDF2-SHA256-100000/AES-256-GCM";
const PBKDF2_ITERATIONS: u32 = 100_000;
const SALT_BYTES: usize = 16;
const IV_BYTES: usize = 12;
const TAG_BYTES: usize = 16;
const MAX_BUNDLE_BYTES: usize = 64 * 1024 * 1024;
const MAX_LEDGER_ENTRIES: usize = 10_000;
const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportFailureKind {
    BadFormat,
    BadVersion,
    BadHeader,
    DecryptionFailure,
    ChainFailure,
    LengthMismatch,
    BadPayload,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportFailure {
    pub kind: ImportFailureKind,
    pub reason: String,
}

impl fmt::Display for ImportFailure {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.reason)
    }
}

impl std::error::Error for ImportFailure {}

fn failure(kind: ImportFailureKind, reason: impl Into<String>) -> ImportFailure {
    ImportFailure {
        kind,
        reason: reason.into(),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct LedgerEntry {
    pub entry_id: String,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub period_id: Option<String>,
    #[serde(default)]
    pub day_id: Option<String>,
    pub body: String,
    pub prev_hash: String,
    pub hash: String,
    #[serde(flatten)]
    pub fields: BTreeMap<String, Value>,
}

impl LedgerEntry {
    pub fn journal_level(&self) -> &str {
        self.level.as_deref().unwrap_or("day")
    }

    pub fn period(&self) -> Option<&str> {
        self.period_id.as_deref().or(self.day_id.as_deref())
    }

    pub fn timestamp(&self) -> Option<&Value> {
        self.fields.get("timestamp")
    }

    pub fn sealed(&self) -> Option<&Value> {
        self.fields.get("sealed")
    }
}

#[derive(Debug, Clone)]
pub struct ValidatedBundle {
    pub ledger: Vec<LedgerEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Header {
    app: String,
    version: String,
    exported_at: String,
    chain_length: u64,
    salt: String,
    iv: String,
    algorithm: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Payload {
    app: String,
    version: String,
    exported_at: String,
    chain_length: u64,
    ledger: Vec<LedgerEntry>,
}

pub fn parse_and_decrypt(bytes: &[u8], phrase: &str) -> Result<ValidatedBundle, ImportFailure> {
    if bytes.len() > MAX_BUNDLE_BYTES {
        return Err(failure(
            ImportFailureKind::BadFormat,
            format!("Bundle exceeds the {MAX_BUNDLE_BYTES}-byte limit"),
        ));
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|_| failure(ImportFailureKind::BadFormat, "Bundle is not UTF-8 JSON"))?;
    let envelope: Value = serde_json::from_str(text)
        .map_err(|_| failure(ImportFailureKind::BadFormat, "Bundle is not valid JSON"))?;
    let object = envelope
        .as_object()
        .ok_or_else(|| failure(ImportFailureKind::BadFormat, "Bundle must be a JSON object"))?;

    if object.get("format").and_then(Value::as_str) != Some(FORMAT) {
        return Err(failure(
            ImportFailureKind::BadFormat,
            "Bundle format must be trismegistus",
        ));
    }
    if object.get("format_version").and_then(Value::as_u64) != Some(1) {
        return Err(failure(
            ImportFailureKind::BadVersion,
            "Unsupported trismegistus format_version; expected 1",
        ));
    }
    if object.len() != 4
        || object.keys().any(|key| {
            !["format", "format_version", "header", "ciphertext"].contains(&key.as_str())
        })
    {
        return Err(failure(
            ImportFailureKind::BadFormat,
            "Bundle contains unexpected top-level fields",
        ));
    }
    let header_value = object
        .get("header")
        .ok_or_else(|| failure(ImportFailureKind::BadHeader, "Bundle header is missing"))?;
    let header: Header = serde_json::from_value(header_value.clone())
        .map_err(|_| failure(ImportFailureKind::BadHeader, "Bundle header is malformed"))?;
    let ciphertext = object
        .get("ciphertext")
        .and_then(Value::as_str)
        .ok_or_else(|| failure(ImportFailureKind::BadHeader, "Bundle ciphertext is missing"))?;

    if header.algorithm != ALGORITHM
        || header.app.is_empty()
        || header.version.is_empty()
        || !valid_iso_timestamp(&header.exported_at)
    {
        return Err(failure(
            ImportFailureKind::BadHeader,
            "Bundle header metadata or algorithm is invalid",
        ));
    }
    let salt = decode_standard_base64(&header.salt, "salt", SALT_BYTES)
        .map_err(|reason| failure(ImportFailureKind::BadHeader, reason))?;
    let iv = decode_standard_base64(&header.iv, "iv", IV_BYTES)
        .map_err(|reason| failure(ImportFailureKind::BadHeader, reason))?;
    let ciphertext = decode_standard_base64(ciphertext, "ciphertext", 0)
        .map_err(|reason| failure(ImportFailureKind::BadHeader, reason))?;
    if ciphertext.len() < TAG_BYTES {
        return Err(failure(
            ImportFailureKind::BadHeader,
            "Ciphertext is shorter than the AES-GCM authentication tag",
        ));
    }

    let normalized_phrase = Zeroizing::new(normalize_phrase(phrase));
    if normalized_phrase.is_empty() {
        return Err(failure(
            ImportFailureKind::DecryptionFailure,
            "Decryption failed: transfer phrase is empty or incorrect",
        ));
    }
    let mut key = Zeroizing::new([0_u8; 32]);
    pbkdf2_hmac::<Sha256>(
        normalized_phrase.as_bytes(),
        &salt,
        PBKDF2_ITERATIONS,
        key.as_mut(),
    );
    let cipher = Aes256Gcm::new_from_slice(key.as_ref()).map_err(|_| {
        failure(
            ImportFailureKind::DecryptionFailure,
            "Could not initialize AES-256-GCM",
        )
    })?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
        .map_err(|_| {
            failure(
                ImportFailureKind::DecryptionFailure,
                "Decryption failed: wrong phrase or tampered bundle",
            )
        })?;
    let payload_result: Result<Payload, _> = serde_json::from_slice(&plaintext);
    let mut plaintext = plaintext;
    plaintext.zeroize();
    let payload = payload_result.map_err(|_| {
        failure(
            ImportFailureKind::BadPayload,
            "Decrypted bundle payload is not valid JSON",
        )
    })?;

    if payload.app.is_empty()
        || payload.version.is_empty()
        || !valid_iso_timestamp(&payload.exported_at)
    {
        return Err(failure(
            ImportFailureKind::BadPayload,
            "Decrypted payload metadata is invalid",
        ));
    }
    if header.chain_length != payload.chain_length
        || usize::try_from(payload.chain_length).ok() != Some(payload.ledger.len())
    {
        return Err(failure(
            ImportFailureKind::LengthMismatch,
            "Header/payload chain_length does not match ledger length",
        ));
    }
    if payload.ledger.len() > MAX_LEDGER_ENTRIES {
        return Err(failure(
            ImportFailureKind::BadPayload,
            format!("Ledger exceeds the {MAX_LEDGER_ENTRIES}-entry limit"),
        ));
    }
    validate_chain(&payload.ledger)?;
    Ok(ValidatedBundle {
        ledger: payload.ledger,
    })
}

fn normalize_phrase(phrase: &str) -> String {
    phrase
        .to_lowercase()
        .split(|character: char| character.is_whitespace() || character == '-')
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn decode_standard_base64(
    encoded: &str,
    label: &str,
    expected_length: usize,
) -> Result<Vec<u8>, String> {
    let decoded = STANDARD
        .decode(encoded)
        .map_err(|_| format!("{label} is not standard base64"))?;
    if STANDARD.encode(&decoded) != encoded {
        return Err(format!("{label} is not canonical standard base64"));
    }
    if expected_length != 0 && decoded.len() != expected_length {
        return Err(format!(
            "{label} must decode to exactly {expected_length} bytes"
        ));
    }
    Ok(decoded)
}

fn valid_iso_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() < 20
        || bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
        || !bytes[..4].iter().all(u8::is_ascii_digit)
        || !bytes[5..7].iter().all(u8::is_ascii_digit)
        || !bytes[8..10].iter().all(u8::is_ascii_digit)
        || !bytes[11..13].iter().all(u8::is_ascii_digit)
        || !bytes[14..16].iter().all(u8::is_ascii_digit)
        || !bytes[17..19].iter().all(u8::is_ascii_digit)
    {
        return false;
    }
    let (year, month, day, hour, minute, second) = (
        value[..4].parse::<u16>().ok(),
        value[5..7].parse::<u8>().ok(),
        value[8..10].parse::<u8>().ok(),
        value[11..13].parse::<u8>().ok(),
        value[14..16].parse::<u8>().ok(),
        value[17..19].parse::<u8>().ok(),
    );
    if !matches!(month, Some(1..=12))
        || !matches!(hour, Some(0..=23))
        || !matches!(minute, Some(0..=59))
        || !matches!(second, Some(0..=60))
    {
        return false;
    }
    let (Some(year), Some(month), Some(day)) = (year, month, day) else {
        return false;
    };
    let days_in_month = match month {
        2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if day == 0 || day > days_in_month {
        return false;
    }
    // JavaScript toISOString() always emits fractional seconds (e.g. ".123Z").
    let mut suffix = &value[19..];
    if let Some(fraction) = suffix.strip_prefix('.') {
        let digits = fraction.bytes().take_while(u8::is_ascii_digit).count();
        if digits == 0 || digits > 9 {
            return false;
        }
        suffix = &fraction[digits..];
    }
    if suffix == "Z" {
        return true;
    }
    let zone = suffix
        .strip_prefix('+')
        .or_else(|| suffix.strip_prefix('-'));
    let Some(zone) = zone else {
        return false;
    };
    let zone = zone.as_bytes();
    zone.len() == 5
        && zone[2] == b':'
        && zone[..2].iter().all(u8::is_ascii_digit)
        && zone[3..].iter().all(u8::is_ascii_digit)
        && (zone[0] - b'0') * 10 + (zone[1] - b'0') <= 23
        && (zone[3] - b'0') * 10 + (zone[4] - b'0') <= 59
}

fn validate_chain(ledger: &[LedgerEntry]) -> Result<(), ImportFailure> {
    let mut previous_hash = GENESIS_HASH;
    for (index, entry) in ledger.iter().enumerate() {
        let period = entry.period().ok_or_else(|| {
            failure(
                ImportFailureKind::ChainFailure,
                format!("Ledger entry {} has no period_id or day_id", index + 1),
            )
        })?;
        if entry.entry_id.trim().is_empty() {
            return Err(failure(
                ImportFailureKind::ChainFailure,
                format!("Ledger entry {} is missing its ID or body", index + 1),
            ));
        }
        let path = entry.fields.get("path").and_then(Value::as_str);
        let season = entry.fields.get("season").and_then(Value::as_str);
        let timestamp = entry.fields.get("timestamp");
        let sealed = entry.fields.get("sealed").and_then(Value::as_bool);
        if path.is_none()
            || season.is_none()
            || !timestamp.is_some_and(valid_phone_timestamp)
            || sealed.is_none()
            || entry.body.len() > 1024 * 1024
            || entry.entry_id.len() > 256
            || period.len() > 128
            || path.is_some_and(|value| value.len() > 1024)
            || season.is_some_and(|value| value.len() > 128)
            || entry
                .fields
                .keys()
                .any(|key| !["path", "season", "timestamp", "sealed"].contains(&key.as_str()))
            || entry
                .level
                .as_deref()
                .is_some_and(|level| !["day", "month", "season", "year"].contains(&level))
        {
            return Err(failure(
                ImportFailureKind::BadPayload,
                format!("Ledger entry {} has invalid required fields", index + 1),
            ));
        }
        if !is_lower_hex_hash(&entry.prev_hash) || !is_lower_hex_hash(&entry.hash) {
            return Err(failure(
                ImportFailureKind::ChainFailure,
                format!("Ledger entry {} has a malformed hash", index + 1),
            ));
        }
        if entry.prev_hash != previous_hash {
            return Err(failure(
                ImportFailureKind::ChainFailure,
                format!("Hash chain is broken at ledger entry {}", index + 1),
            ));
        }
        let calculated = hex::encode(Sha256::digest(
            format!("{period}:{}:{}", entry.body, entry.prev_hash).as_bytes(),
        ));
        if calculated != entry.hash {
            return Err(failure(
                ImportFailureKind::ChainFailure,
                format!("Hash mismatch at ledger entry {}", index + 1),
            ));
        }
        previous_hash = &entry.hash;
    }
    Ok(())
}

fn valid_phone_timestamp(value: &Value) -> bool {
    timestamp_to_iso(value).is_ok()
}

fn is_lower_hex_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

const SESSION_LIFETIME: Duration = Duration::from_secs(5 * 60);
const HTTP_HEADER_LIMIT: usize = 8 * 1024;
const MAX_HTTP_BODY_BYTES: usize = MAX_BUNDLE_BYTES;

#[derive(Default)]
pub struct ImportRuntime {
    active: Arc<Mutex<Option<Arc<ActiveSession>>>>,
    previews: Arc<Mutex<HashMap<String, PendingPreview>>>,
}

struct ActiveSession {
    token: Mutex<Zeroizing<String>>,
    phrase: Mutex<Zeroizing<String>>,
    device_name: String,
    expires_at: Instant,
    active: AtomicBool,
    received: AtomicBool,
    pending_body: Mutex<Option<Vec<u8>>>,
    pending_bundle: Mutex<Option<ValidatedBundle>>,
}

impl ActiveSession {
    fn clear(&self) {
        self.active.store(false, Ordering::SeqCst);
        if let Ok(mut phrase) = self.phrase.lock() {
            phrase.zeroize();
        }
        if let Ok(mut token) = self.token.lock() {
            token.zeroize();
        }
        if let Ok(mut body) = self.pending_body.lock() {
            if let Some(body) = body.as_mut() {
                body.zeroize();
            }
            *body = None;
        }
        if let Ok(mut bundle) = self.pending_bundle.lock() {
            *bundle = None;
        }
    }
}

struct PendingPreview {
    bundle: ValidatedBundle,
    bytes: Vec<u8>,
    session: Option<Arc<ActiveSession>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub preview_id: String,
    pub entry_count: usize,
    pub per_level_counts: BTreeMap<String, usize>,
    pub device_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSessionInfo {
    pub session: String,
    pub phrase: String,
    pub endpoint: String,
    pub device_name: String,
    pub qr_code: String,
    pub qr_svg: String,
}

#[derive(Serialize)]
struct SessionQr<'a> {
    v: u8,
    #[serde(rename = "type")]
    kind: &'static str,
    session: &'a str,
    phrase: &'a str,
    endpoint: &'a str,
    mac: &'a str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReceipt {
    pub imported: usize,
    pub skipped: usize,
    pub per_level_counts: BTreeMap<String, usize>,
    pub warnings: Vec<String>,
}

pub fn start_session(
    app: AppHandle,
    runtime: &ImportRuntime,
    quarantine: crate::sync::quarantine::QuarantineStore,
) -> Result<ImportSessionInfo, String> {
    let mut active_slot = runtime
        .active
        .lock()
        .map_err(|_| "Import session lock poisoned".to_string())?;
    if let Some(session) = active_slot.take() {
        if session.active.load(Ordering::SeqCst) && Instant::now() < session.expires_at {
            *active_slot = Some(session);
            return Err("An import session is already active".into());
        }
        session.clear();
    }

    let device_name = mac_display_name();
    let phrase = random_transfer_phrase();
    let token = random_hex_token();
    let local_ip = local_lan_ipv4()?;
    let listener = TcpListener::bind(SocketAddr::new(IpAddr::V4(local_ip), 0))
        .map_err(|error| format!("Cannot bind the local import listener: {error}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Cannot configure the local import listener: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Cannot inspect local import listener: {error}"))?
        .port();
    let endpoint = format!("http://{local_ip}:{port}/import");
    let qr_code = serde_json::to_string(&SessionQr {
        v: 1,
        kind: "citadel-import",
        session: &token,
        phrase: &phrase,
        endpoint: &endpoint,
        mac: &device_name,
    })
    .map_err(|error| format!("Cannot encode import QR payload: {error}"))?;
    let qr = qrcode::QrCode::new(qr_code.as_bytes())
        .map_err(|error| format!("Cannot generate import QR code: {error}"))?;
    let qr_svg = qr
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(280, 280)
        .build();
    let session = Arc::new(ActiveSession {
        token: Mutex::new(Zeroizing::new(token.clone())),
        phrase: Mutex::new(Zeroizing::new(phrase.clone())),
        device_name: device_name.clone(),
        expires_at: Instant::now() + SESSION_LIFETIME,
        active: AtomicBool::new(true),
        received: AtomicBool::new(false),
        pending_body: Mutex::new(None),
        pending_bundle: Mutex::new(None),
    });
    *active_slot = Some(session.clone());
    drop(active_slot);

    let active_sessions = runtime.active.clone();
    let previews = runtime.previews.clone();
    let listener_quarantine = quarantine.clone();
    let listener_session = session.clone();
    let spawn_result = thread::Builder::new()
        .name("citadel-trmgts-listener".into())
        .spawn(move || {
            run_listener(
                listener,
                listener_session,
                app,
                active_sessions,
                previews,
                listener_quarantine,
            );
        });
    if let Err(error) = spawn_result {
        session.clear();
        if let Ok(mut active) = runtime.active.lock() {
            *active = None;
        }
        return Err(format!("Cannot start the local import listener: {error}"));
    }

    Ok(ImportSessionInfo {
        session: token,
        phrase,
        endpoint,
        device_name,
        qr_code,
        qr_svg,
    })
}

fn random_hex_token() -> String {
    let mut bytes = [0_u8; 16];
    OsRng.fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    bytes.zeroize();
    token
}

fn random_transfer_phrase() -> String {
    let mut words = Vec::with_capacity(3);
    for _ in 0..3 {
        words.push(crate::sync::pairing::SAS_WORDLIST[OsRng.next_u32() as usize & 0xff]);
    }
    words.join("-")
}

fn local_lan_ipv4() -> Result<Ipv4Addr, String> {
    let interfaces = get_if_addrs::get_if_addrs()
        .map_err(|error| format!("Cannot inspect local network interfaces: {error}"))?;
    interfaces
        .into_iter()
        .filter_map(|interface| match interface.ip() {
            IpAddr::V4(address)
                if !address.is_loopback() && (address.is_private() || address.is_link_local()) =>
            {
                Some(address)
            }
            _ => None,
        })
        .next()
        .ok_or_else(|| "No private LAN IPv4 address is available for phone import".into())
}

fn mac_display_name() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("/usr/sbin/scutil")
            .args(["--get", "ComputerName"])
            .output()
        {
            if output.status.success() {
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
    }
    std::env::var("HOSTNAME")
        .ok()
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Mac".into())
}

fn run_listener(
    listener: TcpListener,
    session: Arc<ActiveSession>,
    app: AppHandle,
    active_sessions: Arc<Mutex<Option<Arc<ActiveSession>>>>,
    previews: Arc<Mutex<HashMap<String, PendingPreview>>>,
    quarantine: crate::sync::quarantine::QuarantineStore,
) {
    while session.active.load(Ordering::SeqCst) && Instant::now() < session.expires_at {
        match listener.accept() {
            Ok((mut stream, _peer)) => {
                let result = handle_http_connection(&mut stream, &session, &app, &quarantine);
                if let Err(error) = result {
                    eprintln!("[citadel] Import listener request failed: {error}");
                    let _ = app.emit("trmgts-import-error", error);
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                let reason = format!("Import listener stopped after a socket error: {error}");
                eprintln!("[citadel] {reason}");
                let _ = app.emit("trmgts-import-error", reason);
                break;
            }
        }
    }
    session.clear();
    if let Ok(mut active) = active_sessions.lock() {
        if active
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, &session))
        {
            *active = None;
        }
    }
    if let Ok(mut pending) = previews.lock() {
        pending.retain(|_, preview| {
            !preview
                .session
                .as_ref()
                .is_some_and(|candidate| Arc::ptr_eq(candidate, &session))
        });
    }
    let _ = app.emit("trmgts-import-expired", ());
}

struct HttpRequest {
    method: String,
    path: String,
    body: Vec<u8>,
}

// macOS accepted sockets inherit the listener's non-blocking mode, which breaks multi-segment bodies.
fn configure_accepted_stream(stream: &TcpStream) -> std::io::Result<()> {
    stream.set_nonblocking(false)?;
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))
}

fn handle_http_connection(
    stream: &mut TcpStream,
    session: &ActiveSession,
    app: &AppHandle,
    quarantine: &crate::sync::quarantine::QuarantineStore,
) -> Result<(), String> {
    configure_accepted_stream(stream)
        .map_err(|error| format!("Cannot configure phone import socket: {error}"))?;
    let expected_token = Zeroizing::new(
        session
            .token
            .lock()
            .map_err(|_| "Import session token lock poisoned".to_string())?
            .to_string(),
    );
    let request = match read_http_request(stream, expected_token.as_str(), session) {
        Ok(request) => request,
        Err((status, reason)) => {
            write_http_response(stream, status, reason, true)?;
            return Ok(());
        }
    };
    if request.method == "OPTIONS" && request.path == "/import" {
        write_http_response(stream, 204, "", true)?;
        return Ok(());
    }
    if session.received.load(Ordering::SeqCst) {
        write_http_response(
            stream,
            409,
            "This import session already received a bundle",
            true,
        )?;
        return Ok(());
    }
    let result = {
        let phrase = session
            .phrase
            .lock()
            .map_err(|_| "Import session phrase lock poisoned".to_string())?;
        parse_and_decrypt(&request.body, phrase.as_str())
    };
    let bundle = match result {
        Ok(bundle) => bundle,
        Err(error) => {
            let reason = quarantine_failure(quarantine, &request.body, &error);
            let _ = app.emit("trmgts-import-rejected", reason.clone());
            write_http_response(stream, 400, &reason, true)?;
            return Ok(());
        }
    };
    let mut pending = session
        .pending_body
        .lock()
        .map_err(|_| "Import session body lock poisoned".to_string())?;
    let mut pending_bundle = session
        .pending_bundle
        .lock()
        .map_err(|_| "Import session payload lock poisoned".to_string())?;
    if !session.active.load(Ordering::SeqCst) || Instant::now() >= session.expires_at {
        write_http_response(stream, 410, "Import session expired", true)?;
        return Ok(());
    }
    if session
        .received
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        write_http_response(
            stream,
            409,
            "This import session already received a bundle",
            true,
        )?;
        return Ok(());
    }
    *pending = Some(request.body);
    *pending_bundle = Some(bundle);
    drop(pending_bundle);
    drop(pending);
    write_http_response(stream, 202, "Bundle received for Mac approval", true)?;
    app.emit("trmgts-import-uploaded", ())
        .map_err(|error| format!("Cannot notify the import window: {error}"))?;
    Ok(())
}

fn read_http_request(
    stream: &mut TcpStream,
    expected_token: &str,
    session: &ActiveSession,
) -> Result<HttpRequest, (u16, &'static str)> {
    let mut reader = BufReader::new(stream);
    let request_line = read_bounded_line(&mut reader, HTTP_HEADER_LIMIT)?;
    let mut header_size = request_line.len();
    if header_size > HTTP_HEADER_LIMIT {
        return Err((431, "HTTP headers too large"));
    }
    let request_line =
        String::from_utf8(request_line).map_err(|_| (400, "Request line is not UTF-8"))?;
    let mut parts = request_line.split_whitespace();
    let method = parts
        .next()
        .ok_or((400, "Missing HTTP method"))?
        .to_string();
    let path = parts
        .next()
        .ok_or((400, "Missing request path"))?
        .to_string();
    if parts.next().is_none() {
        return Err((400, "Missing HTTP version"));
    }

    let mut headers = HashMap::new();
    loop {
        let line = read_bounded_line(&mut reader, HTTP_HEADER_LIMIT)?;
        header_size = header_size.saturating_add(line.len());
        if header_size > HTTP_HEADER_LIMIT {
            return Err((431, "HTTP headers too large"));
        }
        if line == b"\r\n" || line == b"\n" {
            break;
        }
        let line = std::str::from_utf8(&line).map_err(|_| (400, "HTTP header is not UTF-8"))?;
        let (name, value) = line
            .trim_end()
            .split_once(':')
            .ok_or((400, "Malformed HTTP header"))?;
        let name = name.trim().to_ascii_lowercase();
        if name.is_empty() || headers.insert(name, value.trim().to_string()).is_some() {
            return Err((400, "Duplicate or empty HTTP header"));
        }
    }
    if headers.contains_key("transfer-encoding") {
        return Err((400, "Chunked transfer encoding is not accepted"));
    }
    if method == "OPTIONS" {
        return Ok(HttpRequest {
            method,
            path,
            body: Vec::new(),
        });
    }
    if method != "POST" || path != "/import" {
        return Err((404, "Not found"));
    }
    if !session.active.load(Ordering::SeqCst) || Instant::now() >= session.expires_at {
        return Err((410, "Import session expired"));
    }
    if headers.get("x-citadel-session").map(String::as_str) != Some(expected_token) {
        return Err((403, "Invalid import session token"));
    }
    if !headers
        .get("content-type")
        .and_then(|value| value.split(';').next())
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/json"))
    {
        return Err((415, "Expected application/json"));
    }
    let length = headers
        .get("content-length")
        .ok_or((411, "Content-Length is required"))?
        .parse::<usize>()
        .map_err(|_| (400, "Invalid Content-Length"))?;
    if length == 0 {
        return Err((400, "Request body is empty"));
    }
    if length > MAX_HTTP_BODY_BYTES {
        return Err((413, "Request body exceeds the import limit"));
    }
    let mut body = vec![0; length];
    reader
        .read_exact(&mut body)
        .map_err(|_| (400, "Request body is truncated"))?;
    Ok(HttpRequest { method, path, body })
}

fn read_bounded_line<R: std::io::BufRead>(
    reader: &mut R,
    maximum: usize,
) -> Result<Vec<u8>, (u16, &'static str)> {
    let mut line = Vec::new();
    loop {
        let available = reader
            .fill_buf()
            .map_err(|_| (400, "Cannot read HTTP request"))?;
        if available.is_empty() {
            return Err((400, "Truncated HTTP request"));
        }
        let through_newline = available
            .iter()
            .position(|byte| *byte == b'\n')
            .map(|index| index + 1);
        let remaining = maximum.saturating_sub(line.len());
        let count = through_newline
            .unwrap_or(available.len())
            .min(remaining + 1);
        line.extend_from_slice(&available[..count]);
        reader.consume(count);
        if line.len() > maximum {
            return Err((431, "HTTP headers too large"));
        }
        if through_newline.is_some_and(|newline| newline <= count) {
            return Ok(line);
        }
    }
}

fn write_http_response(
    stream: &mut TcpStream,
    status: u16,
    body: &str,
    cors: bool,
) -> Result<(), String> {
    let reason = match status {
        204 => "No Content",
        202 => "Accepted",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        411 => "Length Required",
        413 => "Payload Too Large",
        415 => "Unsupported Media Type",
        431 => "Request Header Fields Too Large",
        409 => "Conflict",
        410 => "Gone",
        _ => "Error",
    };
    let cors_headers = if cors {
        "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-Citadel-Session\r\n"
    } else {
        ""
    };
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n{cors_headers}\r\n{body}",
        body.len()
    )
    .and_then(|_| stream.flush())
    .map_err(|error| format!("Cannot answer phone import request: {error}"))
}

fn active_session(runtime: &ImportRuntime) -> Result<Arc<ActiveSession>, String> {
    let session = runtime
        .active
        .lock()
        .map_err(|_| "Import session lock poisoned".to_string())?
        .clone()
        .ok_or_else(|| "There is no active phone import session".to_string())?;
    if !session.active.load(Ordering::SeqCst) || Instant::now() >= session.expires_at {
        session.clear();
        return Err("Phone import session expired".into());
    }
    Ok(session)
}

pub fn end_session(runtime: &ImportRuntime, token: &str) -> Result<(), String> {
    let session = {
        let mut active = runtime
            .active
            .lock()
            .map_err(|_| "Import session lock poisoned".to_string())?;
        let Some(session) = active.as_ref().cloned() else {
            return Ok(());
        };
        let session_token = session
            .token
            .lock()
            .map_err(|_| "Import session token lock poisoned".to_string())?;
        if session_token.as_str() != token {
            return Err("Import session token does not match".into());
        }
        drop(session_token);
        active.take()
    };
    if let Some(session) = session {
        session.clear();
    }
    Ok(())
}

fn read_bundle_file(path: &Path) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Cannot inspect .trmgts file: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Import target must be a regular file, not a symlink".into());
    }
    if metadata.len() > MAX_BUNDLE_BYTES as u64 {
        return Err(format!("Bundle exceeds the {MAX_BUNDLE_BYTES}-byte limit"));
    }
    fs::read(path).map_err(|error| format!("Cannot read .trmgts file: {error}"))
}

fn quarantine_bundle(
    services: &crate::DataServices,
    bytes: &[u8],
    reason: &str,
) -> Result<(), String> {
    quarantine_bytes(services.sync.quarantine(), bytes, reason)
}

fn quarantine_bytes(
    quarantine: &crate::sync::quarantine::QuarantineStore,
    bytes: &[u8],
    reason: &str,
) -> Result<(), String> {
    let digest = blake3::hash(bytes).to_hex().to_string();
    quarantine.write_record(&format!("trmgts-{digest}.json"), bytes)?;
    quarantine.append_json_line(
        "conflicts.jsonl",
        &serde_json::json!({
            "kind": "trmgts-import",
            "bundleHash": digest,
            "reason": reason,
        }),
    )
}

fn quarantine_failure(
    quarantine: &crate::sync::quarantine::QuarantineStore,
    bytes: &[u8],
    failure: &ImportFailure,
) -> String {
    match quarantine_bytes(quarantine, bytes, &failure.to_string()) {
        Ok(()) => format!("{:?}: {}", failure.kind, failure),
        Err(error) => format!(
            "{:?}: {}; additionally, quarantine storage failed: {error}",
            failure.kind, failure
        ),
    }
}

fn quarantine_error(
    services: &crate::DataServices,
    bytes: &[u8],
    failure: &ImportFailure,
) -> String {
    quarantine_failure(services.sync.quarantine(), bytes, failure)
}

fn quarantine_reason(services: &crate::DataServices, bytes: &[u8], reason: &str) -> String {
    match quarantine_bundle(services, bytes, reason) {
        Ok(()) => reason.to_string(),
        Err(error) => format!("{reason}; additionally, quarantine storage failed: {error}"),
    }
}

fn level_counts(ledger: &[LedgerEntry]) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for entry in ledger {
        *counts.entry(entry.journal_level().to_string()).or_insert(0) += 1;
    }
    counts
}

fn store_preview(
    runtime: &ImportRuntime,
    bundle: ValidatedBundle,
    bytes: Vec<u8>,
    session: Option<Arc<ActiveSession>>,
    device_name: Option<String>,
) -> Result<ImportPreview, String> {
    let preview_id = random_hex_token();
    let entry_count = bundle.ledger.len();
    let per_level_counts = level_counts(&bundle.ledger);
    let mut previews = runtime
        .previews
        .lock()
        .map_err(|_| "Import preview lock poisoned".to_string())?;
    if previews.len() >= 4 {
        return Err("Too many pending import previews; discard one before continuing".into());
    }
    previews.insert(
        preview_id.clone(),
        PendingPreview {
            bundle,
            bytes,
            session,
        },
    );
    Ok(ImportPreview {
        preview_id,
        entry_count,
        per_level_counts,
        device_name,
    })
}

#[tauri::command]
pub fn trmgts_start_session(
    app: AppHandle,
    vault: State<'_, crate::VaultRuntime>,
    runtime: State<'_, ImportRuntime>,
) -> Result<ImportSessionInfo, String> {
    let services_guard = vault.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    start_session(app, &runtime, services.sync.quarantine().clone())
}

#[tauri::command]
pub fn trmgts_end_session(
    mut token: String,
    runtime: State<'_, ImportRuntime>,
) -> Result<(), String> {
    let result = end_session(&runtime, &token);
    token.zeroize();
    result
}

#[tauri::command]
pub fn trmgts_preview_pending(importer: State<'_, ImportRuntime>) -> Result<ImportPreview, String> {
    let session = active_session(&importer)?;
    if !session.received.load(Ordering::SeqCst) {
        return Err("The phone has not sent a bundle yet".into());
    }
    let bytes = session
        .pending_body
        .lock()
        .map_err(|_| "Import session body lock poisoned".to_string())?
        .take()
        .ok_or_else(|| "The received bundle is no longer available".to_string())?;
    let bundle = session
        .pending_bundle
        .lock()
        .map_err(|_| "Import session payload lock poisoned".to_string())?
        .take()
        .ok_or_else(|| "The decrypted bundle is no longer available".to_string())?;
    store_preview(
        &importer,
        bundle,
        bytes,
        Some(session.clone()),
        Some(session.device_name.clone()),
    )
}

#[tauri::command]
pub fn trmgts_preview_file(
    path: String,
    phrase: String,
    session_token: Option<String>,
    runtime: State<'_, crate::VaultRuntime>,
    importer: State<'_, ImportRuntime>,
) -> Result<ImportPreview, String> {
    let phrase = Zeroizing::new(phrase);
    let bytes = match read_bundle_file(Path::new(&path)) {
        Ok(bytes) => bytes,
        Err(error) => return Err(error),
    };
    if Path::new(&path)
        .extension()
        .and_then(|extension| extension.to_str())
        != Some("trmgts")
    {
        return Err("Choose a .trmgts file".into());
    }
    let active = match session_token {
        Some(token) => {
            let session = active_session(&importer)?;
            let expected = session
                .token
                .lock()
                .map_err(|_| "Import session token lock poisoned".to_string())?;
            if expected.as_str() != token {
                return Err("Import session token does not match".into());
            }
            drop(expected);
            Some(session)
        }
        None => None,
    };
    let result = parse_and_decrypt(&bytes, phrase.as_str());
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let bundle = match result {
        Ok(bundle) => bundle,
        Err(error) => return Err(quarantine_error(services, &bytes, &error)),
    };
    let device_name = active.as_ref().map(|session| session.device_name.clone());
    store_preview(&importer, bundle, bytes, active, device_name)
}

#[tauri::command]
pub fn trmgts_discard_preview(
    preview_id: String,
    importer: State<'_, ImportRuntime>,
) -> Result<(), String> {
    let preview = importer
        .previews
        .lock()
        .map_err(|_| "Import preview lock poisoned".to_string())?
        .remove(&preview_id);
    if let Some(session) = preview.and_then(|preview| preview.session) {
        let token = session
            .token
            .lock()
            .map_err(|_| "Import session token lock poisoned".to_string())?
            .to_string();
        end_session(&importer, &token)?;
    }
    Ok(())
}

fn close_preview_session(importer: &ImportRuntime, preview: &PendingPreview) -> Result<(), String> {
    if let Some(session) = &preview.session {
        let token = Zeroizing::new(
            session
                .token
                .lock()
                .map_err(|_| "Import session token lock poisoned".to_string())?
                .to_string(),
        );
        end_session(importer, token.as_str())?;
    }
    Ok(())
}

fn timestamp_to_iso(value: &Value) -> Result<String, String> {
    if let Some(timestamp) = value.as_i64() {
        return chrono::DateTime::from_timestamp(timestamp, 0)
            .map(|datetime| datetime.to_rfc3339())
            .ok_or_else(|| "Phone timestamp is outside the supported range".into());
    }
    if let Some(timestamp) = value.as_f64() {
        if !timestamp.is_finite() {
            return Err("Phone timestamp must be finite".into());
        }
        let whole_seconds = timestamp.floor();
        let rounded_nanos = ((timestamp - whole_seconds) * 1_000_000_000.0).round() as i64;
        let mut seconds = whole_seconds as i64;
        let nanos = if rounded_nanos >= 1_000_000_000 {
            seconds = seconds
                .checked_add(1)
                .ok_or_else(|| "Phone timestamp is outside the supported range".to_string())?;
            0
        } else {
            rounded_nanos as u32
        };
        return chrono::DateTime::from_timestamp(seconds, nanos)
            .map(|datetime| datetime.to_rfc3339())
            .ok_or_else(|| "Phone timestamp is outside the supported range".into());
    }
    if let Some(timestamp) = value.as_str() {
        return chrono::DateTime::parse_from_rfc3339(timestamp)
            .map(|datetime| datetime.to_rfc3339())
            .map_err(|_| "Phone timestamp is not a valid ISO timestamp".into());
    }
    Err("Phone timestamp must be epoch seconds or an ISO timestamp".into())
}

fn journal_input(entry: &LedgerEntry) -> Result<crate::journal_log::JournalEntryInput, String> {
    let level = entry.journal_level().to_ascii_lowercase();
    let period = entry
        .period()
        .ok_or_else(|| "Ledger entry has no journal period".to_string())?
        .to_string();
    // The phone writes seasons as "Autumn 2026"; the chambers key them as "2026-AUTUMN".
    let period = if level == "season" {
        crate::journal_log::normalize_season_period_str(&period)
    } else {
        period
    };
    let timestamp = timestamp_to_iso(
        entry
            .timestamp()
            .ok_or_else(|| "Ledger entry has no timestamp".to_string())?,
    )?;
    let mut metadata = BTreeMap::new();
    for key in ["path", "season", "timestamp", "sealed"] {
        if let Some(value) = entry.fields.get(key) {
            metadata.insert(format!("phone_{key}"), value.clone());
        }
    }
    metadata.insert("phone_hash".into(), Value::String(entry.hash.clone()));
    metadata.insert(
        "phone_prev_hash".into(),
        Value::String(entry.prev_hash.clone()),
    );
    Ok(crate::journal_log::JournalEntryInput {
        id: entry.entry_id.clone(),
        day: period.clone(),
        created_at: timestamp.clone(),
        updated_at: timestamp,
        text: entry.body.clone(),
        tags: vec!["phone-import".into()],
        metadata,
        timezone_offset: chrono::Local::now().offset().local_minus_utc() / 60,
        level: Some(level),
        period: Some(period),
    })
}

#[tauri::command]
pub fn trmgts_accept_import(
    preview_id: String,
    runtime: State<'_, crate::VaultRuntime>,
    importer: State<'_, ImportRuntime>,
) -> Result<ImportReceipt, String> {
    let preview = importer
        .previews
        .lock()
        .map_err(|_| "Import preview lock poisoned".to_string())?
        .remove(&preview_id)
        .ok_or_else(|| "Import preview has expired or was already used".to_string())?;
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let preflight = (|| {
        let existing = services.journal.verified_events()?;
        let mut existing_ids = existing
            .iter()
            .map(|event| event.payload.entry_id.clone())
            .collect::<HashSet<_>>();
        let mut inputs = Vec::new();
        let mut skipped = 0usize;
        for entry in &preview.bundle.ledger {
            if !existing_ids.insert(entry.entry_id.clone()) {
                skipped += 1;
                continue;
            }
            let input = journal_input(entry)?;
            crate::journal_log::assert_entry_period_writable(&input)?;
            if services.journal.get_day_status(&input.day)?.is_crystallized {
                return Err(format!(
                    "Import rejected before writing: journal period {} is sealed",
                    input.day
                ));
            }
            inputs.push((input, entry.journal_level().to_string()));
        }
        Ok((inputs, skipped))
    })();
    let (inputs, skipped) = match preflight {
        Ok(result) => result,
        Err(reason) => {
            let reason = quarantine_reason(services, &preview.bytes, &reason);
            close_preview_session(&importer, &preview)?;
            return Err(reason);
        }
    };

    let mut imported = 0usize;
    let mut per_level_counts = BTreeMap::new();
    let mut warnings = Vec::new();
    for (input, level) in inputs {
        let event = match services.journal.append_entry(input) {
            Ok(event) => event,
            Err(error) => {
                close_preview_session(&importer, &preview)?;
                return Err(format!(
                    "Import stopped after {imported} entries were appended: {error}"
                ));
            }
        };
        imported += 1;
        *per_level_counts.entry(level).or_insert(0) += 1;
        if let Err(error) = crate::graph::project_entry(
            &services.graph,
            &crate::graph::GraphEntryInput {
                id: event.payload.entry_id.clone(),
                day: event.payload.day.clone(),
                created_at: event.payload.created_at.clone(),
                updated_at: event.payload.updated_at.clone(),
                text: event.payload.text.clone(),
                tags: event.payload.tags.clone(),
                concepts: Vec::new(),
            },
        ) {
            warnings.push(format!(
                "Journal entry {} was saved, but graph projection failed: {error}",
                event.payload.entry_id
            ));
        }
    }
    if imported > 0 {
        let events = services.journal.verified_events()?;
        if let Err(error) = services.semantic.rebuild(&events) {
            warnings.push(format!("Semantic index refresh failed: {error}"));
        }
    }
    close_preview_session(&importer, &preview)?;
    Ok(ImportReceipt {
        imported,
        skipped,
        per_level_counts,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE_PHRASE: &str = "oak-river-moon";

    #[test]
    fn season_periods_are_keyed_like_the_chambers() {
        let entry: LedgerEntry = serde_json::from_value(serde_json::json!({
            "entry_id": "s1", "level": "season", "period_id": "Autumn 2026",
            "path": "2026/Autumn", "season": "Autumn 2026", "timestamp": 1792860000,
            "body": "b", "prev_hash": "0", "hash": "0", "sealed": false
        }))
        .unwrap();
        let input = journal_input(&entry).unwrap();
        assert_eq!(input.period.as_deref(), Some("2026-AUTUMN"));
        assert_eq!(input.day, "2026-AUTUMN");
    }

    #[test]
    fn accepts_bundle_shaped_like_phone_app_js_export() {
        let bytes = include_bytes!("../tests/fixtures/trmgts_phone_app_js_v1.trmgts");
        let imported = parse_and_decrypt(bytes, "bison-border-orbit").unwrap();
        assert_eq!(imported.ledger.len(), 3);
    }

    #[test]
    fn accepts_javascript_iso_timestamps_with_milliseconds() {
        assert!(valid_iso_timestamp("2026-10-24T16:40:00.123Z"));
        assert!(valid_iso_timestamp("2026-10-24T16:40:00Z"));
        assert!(valid_iso_timestamp("2026-10-24T16:40:00.5+02:00"));
        assert!(!valid_iso_timestamp("2026-10-24T16:40:00.Z"));
        assert!(!valid_iso_timestamp("2026-10-24T16:40:00.123"));
        assert!(!valid_iso_timestamp("2026-10-24T16:40:00.1234567890Z"));
    }

    #[test]
    fn accepted_stream_reads_body_sent_in_delayed_chunks() {
        use std::io::{Read, Write};
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let addr = listener.local_addr().unwrap();
        let sender = thread::spawn(move || {
            let mut client = std::net::TcpStream::connect(addr).unwrap();
            client.write_all(b"HEAD ").unwrap();
            thread::sleep(Duration::from_millis(300));
            client.write_all(b"BODY").unwrap();
        });
        let mut stream = loop {
            match listener.accept() {
                Ok((stream, _)) => break stream,
                Err(_) => thread::sleep(Duration::from_millis(10)),
            }
        };
        configure_accepted_stream(&stream).unwrap();
        let mut received = Vec::new();
        stream.read_to_end(&mut received).unwrap();
        sender.join().unwrap();
        assert_eq!(received, b"HEAD BODY");
    }

    fn fixture() -> &'static [u8] {
        include_bytes!("../tests/fixtures/trmgts_phone_checker_v1.trmgts")
    }

    #[test]
    fn decrypts_and_validates_phone_checker_fixture() {
        let imported = parse_and_decrypt(fixture(), "Oak River  moon").unwrap();
        assert_eq!(imported.ledger.len(), 2);
        assert_eq!(imported.ledger[0].entry_id, "phone-entry-1");
        assert_eq!(imported.ledger[1].journal_level(), "day");
    }

    #[test]
    fn wrong_phrase_fails_authentication() {
        let error = parse_and_decrypt(fixture(), "oak-river-sun").unwrap_err();
        assert_eq!(error.kind, ImportFailureKind::DecryptionFailure);
    }

    #[test]
    fn tampered_ciphertext_fails_authentication() {
        let mut envelope: Value = serde_json::from_slice(fixture()).unwrap();
        let ciphertext = envelope["ciphertext"].as_str().unwrap();
        let mut bytes = STANDARD.decode(ciphertext).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 1;
        envelope["ciphertext"] = Value::String(STANDARD.encode(bytes));
        let error =
            parse_and_decrypt(&serde_json::to_vec(&envelope).unwrap(), FIXTURE_PHRASE).unwrap_err();
        assert_eq!(error.kind, ImportFailureKind::DecryptionFailure);
    }

    #[test]
    fn rejects_wrong_format_and_version() {
        let mut envelope: Value = serde_json::from_slice(fixture()).unwrap();
        envelope["format"] = Value::String("other".into());
        assert_eq!(
            parse_and_decrypt(&serde_json::to_vec(&envelope).unwrap(), FIXTURE_PHRASE)
                .unwrap_err()
                .kind,
            ImportFailureKind::BadFormat
        );
        envelope["format"] = Value::String(FORMAT.into());
        envelope["format_version"] = Value::from(2);
        assert_eq!(
            parse_and_decrypt(&serde_json::to_vec(&envelope).unwrap(), FIXTURE_PHRASE)
                .unwrap_err()
                .kind,
            ImportFailureKind::BadVersion
        );
    }

    #[test]
    fn rejects_broken_chain_and_length_mismatch() {
        assert_eq!(
            parse_and_decrypt(fixture(), FIXTURE_PHRASE)
                .unwrap()
                .ledger
                .len(),
            2
        );

        let plaintext = decrypt_fixture_payload(fixture(), FIXTURE_PHRASE);
        let mut payload: Value = serde_json::from_slice(&plaintext).unwrap();
        payload["ledger"][1]["prev_hash"] = Value::String(GENESIS_HASH.into());
        let envelope = encrypt_fixture_payload(payload, FIXTURE_PHRASE);
        assert_eq!(
            parse_and_decrypt(&serde_json::to_vec(&envelope).unwrap(), FIXTURE_PHRASE)
                .unwrap_err()
                .kind,
            ImportFailureKind::ChainFailure
        );

        let mut payload: Value =
            serde_json::from_slice(&decrypt_fixture_payload(fixture(), FIXTURE_PHRASE)).unwrap();
        payload["chain_length"] = Value::from(1);
        let envelope = encrypt_fixture_payload(payload, FIXTURE_PHRASE);
        assert_eq!(
            parse_and_decrypt(&serde_json::to_vec(&envelope).unwrap(), FIXTURE_PHRASE)
                .unwrap_err()
                .kind,
            ImportFailureKind::LengthMismatch
        );
    }

    #[test]
    fn truncated_file_is_rejected_without_panicking() {
        assert!(parse_and_decrypt(b"{\"format\":\"trismegistus\"", FIXTURE_PHRASE).is_err());
        assert!(parse_and_decrypt(&fixture()[..fixture().len() / 2], FIXTURE_PHRASE).is_err());
    }

    fn decrypt_fixture_payload(bytes: &[u8], phrase: &str) -> Vec<u8> {
        let envelope: Value = serde_json::from_slice(bytes).unwrap();
        let header: Header = serde_json::from_value(envelope["header"].clone()).unwrap();
        let salt = STANDARD.decode(header.salt).unwrap();
        let iv = STANDARD.decode(header.iv).unwrap();
        let ciphertext = STANDARD
            .decode(envelope["ciphertext"].as_str().unwrap())
            .unwrap();
        let mut key = [0; 32];
        pbkdf2_hmac::<Sha256>(
            normalize_phrase(phrase).as_bytes(),
            &salt,
            PBKDF2_ITERATIONS,
            &mut key,
        );
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        key.zeroize();
        cipher
            .decrypt(Nonce::from_slice(&iv), ciphertext.as_ref())
            .unwrap()
    }

    fn encrypt_fixture_payload(payload: Value, phrase: &str) -> Value {
        let mut envelope: Value = serde_json::from_slice(fixture()).unwrap();
        let header: Header = serde_json::from_value(envelope["header"].clone()).unwrap();
        let salt = STANDARD.decode(header.salt).unwrap();
        let iv = STANDARD.decode(header.iv).unwrap();
        let mut key = [0; 32];
        pbkdf2_hmac::<Sha256>(
            normalize_phrase(phrase).as_bytes(),
            &salt,
            PBKDF2_ITERATIONS,
            &mut key,
        );
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        key.zeroize();
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(&iv),
                serde_json::to_vec(&payload).unwrap().as_ref(),
            )
            .unwrap();
        envelope["ciphertext"] = Value::String(STANDARD.encode(ciphertext));
        envelope
    }
}
