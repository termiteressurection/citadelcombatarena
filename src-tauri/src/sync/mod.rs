pub mod bundle;
pub mod ingestion;
pub mod pairing;
pub mod quarantine;
pub mod reconciliation;
pub mod roster;
pub mod transport;

use crate::graph::GraphState;
use crate::journal_log::{JournalEvent, JournalState};
use crate::semantic_engine::SemanticState;
use crate::sync::ingestion::{ingest_event, IngestDisposition};
use crate::sync::quarantine::QuarantineStore;
use crate::sync::reconciliation::{
    build_summary, expected_incoming, reconcile, root_for_events, validate_inventory, HashRecord,
    MerkleSummary, HASH_RECORDS_PER_PART, MAX_SUMMARY_ENTRIES,
};
use crate::sync::roster::SyncState;
use crate::sync::transport::{HandshakeRole, SecureChannel};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::net::{IpAddr, SocketAddr, TcpListener, TcpStream};
use std::thread;
use std::time::{Duration, Instant};

const MAX_EVENT_BYTES: usize = 1024 * 1024;
const MAX_TRANSFER_BYTES: usize = 256 * 1024 * 1024;
const EVENT_CHUNK_BYTES: usize = 24 * 1024;
const MAX_KNOWN_DEVICES: usize = 256;
const PROTOCOL_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub local_event_count: usize,
    pub peer_event_count: usize,
    pub local_merkle_root: String,
    pub peer_merkle_root: String,
    pub received: usize,
    pub duplicates: usize,
    pub quarantined: usize,
    pub converged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PeerHello {
    protocol_version: u32,
    identity_pubkey: String,
    noise_static_pubkey: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
enum WireMessage {
    Hello(PeerHello),
    Summary(MerkleSummary),
    InventoryPart {
        index: usize,
        records: Vec<HashRecord>,
    },
    InventoryIdle,
    TransferStart {
        event_count: usize,
        total_bytes: usize,
    },
    EventStart {
        event_hash: String,
        event_id: String,
        byte_count: usize,
        chunk_count: usize,
    },
    EventChunk {
        event_hash: String,
        index: usize,
        hex_data: String,
    },
    Receipt(PeerReceipt),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PeerReceipt {
    event_count: usize,
    merkle_root: String,
    received: usize,
    duplicates: usize,
    quarantined: usize,
}

pub fn exchange_stream(
    stream: TcpStream,
    role: HandshakeRole,
    journal: &JournalState,
    graph_state: &GraphState,
    semantic: &SemanticState,
    sync_state: &SyncState,
) -> Result<SyncReport, String> {
    let known_noise = sync_state.known_noise_keys()?;
    let mut channel = SecureChannel::establish(
        stream,
        role,
        &sync_state.noise_identity()?,
        &known_noise,
        sync_state.quarantine(),
    )?;
    exchange_hello(&mut channel, role, journal, sync_state)?;

    let local_events = journal.verified_events()?;
    let (local_summary, local_records) = build_summary(&local_events);
    if local_summary.devices.len() > MAX_KNOWN_DEVICES {
        return Err("Sync summary exceeds the 256-device roster limit".into());
    }
    channel.send(&WireMessage::Summary(local_summary.clone()))?;
    let peer_summary = match channel.receive::<WireMessage>()? {
        WireMessage::Summary(summary) => summary,
        _ => return protocol_reject(sync_state.quarantine(), "Expected peer Merkle summary"),
    };
    if peer_summary.event_count > MAX_SUMMARY_ENTRIES
        || peer_summary.devices.len() > MAX_KNOWN_DEVICES
        || peer_summary.part_count > MAX_SUMMARY_ENTRIES.div_ceil(HASH_RECORDS_PER_PART)
    {
        return protocol_reject(
            sync_state.quarantine(),
            "Peer Merkle summary exceeds limits",
        );
    }

    let rounds = local_summary.part_count.max(peer_summary.part_count);
    let mut peer_records = Vec::with_capacity(peer_summary.event_count);
    for index in 0..rounds {
        if let Some(chunk) = local_records.chunks(HASH_RECORDS_PER_PART).nth(index) {
            channel.send(&WireMessage::InventoryPart {
                index,
                records: chunk.to_vec(),
            })?;
        } else {
            channel.send(&WireMessage::InventoryIdle)?;
        }
        match channel.receive::<WireMessage>()? {
            WireMessage::InventoryPart {
                index: received_index,
                records,
            } if received_index == index && received_index < peer_summary.part_count => {
                peer_records.extend(records);
            }
            WireMessage::InventoryIdle if index >= peer_summary.part_count => {}
            _ => return protocol_reject(sync_state.quarantine(), "Invalid Merkle inventory part"),
        }
    }
    validate_inventory(&peer_summary, &peer_records)
        .map_err(|error| quarantine_protocol(sync_state.quarantine(), &error))?;

    let (outbound, _) = reconcile(&local_events, &peer_records);
    let inbound_hashes = expected_incoming(&local_events, &peer_records);
    let mut received = 0;
    let mut duplicates = 0;
    let mut quarantined = 0;
    match role {
        HandshakeRole::Initiator => {
            send_events(&mut channel, &outbound)?;
            receive_events(
                &mut channel,
                &inbound_hashes,
                journal,
                graph_state,
                sync_state,
                &mut received,
                &mut duplicates,
                &mut quarantined,
            )?;
        }
        HandshakeRole::Responder => {
            receive_events(
                &mut channel,
                &inbound_hashes,
                journal,
                graph_state,
                sync_state,
                &mut received,
                &mut duplicates,
                &mut quarantined,
            )?;
            send_events(&mut channel, &outbound)?;
        }
    }

    let final_events = journal.verified_events()?;
    let local_root = root_for_events(&final_events);
    let local_receipt = PeerReceipt {
        event_count: final_events.len(),
        merkle_root: local_root.clone(),
        received,
        duplicates,
        quarantined,
    };
    let peer_receipt = match role {
        HandshakeRole::Initiator => {
            channel.send(&WireMessage::Receipt(local_receipt.clone()))?;
            receive_receipt(&mut channel, sync_state.quarantine())?
        }
        HandshakeRole::Responder => {
            let peer = receive_receipt(&mut channel, sync_state.quarantine())?;
            channel.send(&WireMessage::Receipt(local_receipt.clone()))?;
            peer
        }
    };
    let converged =
        local_root == peer_receipt.merkle_root && quarantined == 0 && peer_receipt.quarantined == 0;
    if let Err(error) = semantic.rebuild(&final_events) {
        eprintln!("[citadel] semantic index refresh after sync deferred: {error}");
    }
    Ok(SyncReport {
        local_event_count: final_events.len(),
        peer_event_count: peer_receipt.event_count,
        local_merkle_root: local_root,
        peer_merkle_root: peer_receipt.merkle_root,
        received,
        duplicates,
        quarantined,
        converged,
    })
}

fn exchange_hello(
    channel: &mut SecureChannel,
    role: HandshakeRole,
    journal: &JournalState,
    sync: &SyncState,
) -> Result<(), String> {
    let local = sync.local_card()?;
    let hello = PeerHello {
        protocol_version: PROTOCOL_VERSION,
        identity_pubkey: local.identity_pubkey,
        noise_static_pubkey: local.noise_static_pubkey,
    };
    let remote = match role {
        HandshakeRole::Initiator => {
            channel.send(&WireMessage::Hello(hello))?;
            receive_hello(channel, sync.quarantine())?
        }
        HandshakeRole::Responder => {
            let remote = receive_hello(channel, sync.quarantine())?;
            channel.send(&WireMessage::Hello(hello))?;
            remote
        }
    };
    if remote.protocol_version != PROTOCOL_VERSION {
        return protocol_reject(sync.quarantine(), "Unsupported peer sync protocol version");
    }
    let claimed_noise = hex::decode(&remote.noise_static_pubkey)
        .map_err(|_| "Peer hello contains an invalid Noise key".to_string())?;
    if claimed_noise.as_slice() != channel.remote_noise_static()
        || !sync.matches_remote(&remote.identity_pubkey, channel.remote_noise_static())?
    {
        return protocol_reject(
            sync.quarantine(),
            "Peer Ed25519 identity and Noise key do not match the pinned roster",
        );
    }
    let _ = journal;
    Ok(())
}

fn receive_hello(
    channel: &mut SecureChannel,
    quarantine: &QuarantineStore,
) -> Result<PeerHello, String> {
    match channel.receive::<WireMessage>()? {
        WireMessage::Hello(hello) => Ok(hello),
        _ => protocol_reject(quarantine, "Expected authenticated peer identity hello"),
    }
}

fn send_events(channel: &mut SecureChannel, events: &[JournalEvent]) -> Result<(), String> {
    if events.len() > MAX_SUMMARY_ENTRIES {
        return Err("Missing-event range exceeds sync record-count limit".into());
    }
    let encoded = events
        .iter()
        .map(|event| {
            serde_json::to_vec(event)
                .map_err(|error| format!("Cannot encode signed stone: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let total_bytes = encoded.iter().map(Vec::len).sum::<usize>();
    if total_bytes > MAX_TRANSFER_BYTES || encoded.iter().any(|bytes| bytes.len() > MAX_EVENT_BYTES)
    {
        return Err("Signed stones exceed the bounded sync spool size".into());
    }
    channel.send(&WireMessage::TransferStart {
        event_count: encoded.len(),
        total_bytes,
    })?;
    for (event, bytes) in events.iter().zip(encoded.iter()) {
        let chunk_count = bytes.len().div_ceil(EVENT_CHUNK_BYTES);
        channel.send(&WireMessage::EventStart {
            event_hash: event.event_hash.clone(),
            event_id: event.event_id.clone(),
            byte_count: bytes.len(),
            chunk_count,
        })?;
        for (index, chunk) in bytes.chunks(EVENT_CHUNK_BYTES).enumerate() {
            channel.send(&WireMessage::EventChunk {
                event_hash: event.event_hash.clone(),
                index,
                hex_data: hex::encode(chunk),
            })?;
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn receive_events(
    channel: &mut SecureChannel,
    expected: &BTreeSet<String>,
    journal: &JournalState,
    graph_state: &GraphState,
    sync_state: &SyncState,
    received: &mut usize,
    duplicates: &mut usize,
    quarantined: &mut usize,
) -> Result<(), String> {
    let (event_count, total_bytes) = match channel.receive::<WireMessage>()? {
        WireMessage::TransferStart {
            event_count,
            total_bytes,
        } => (event_count, total_bytes),
        _ => return protocol_reject(sync_state.quarantine(), "Expected event transfer header"),
    };
    if event_count != expected.len()
        || event_count > MAX_SUMMARY_ENTRIES
        || total_bytes > MAX_TRANSFER_BYTES
    {
        return protocol_reject(
            sync_state.quarantine(),
            "Peer event transfer exceeds or disagrees with Merkle diff",
        );
    }
    let mut actual_total = 0usize;
    let mut seen = BTreeSet::new();
    for _ in 0..event_count {
        let (event_hash, event_id, byte_count, chunk_count) = match channel
            .receive::<WireMessage>()?
        {
            WireMessage::EventStart {
                event_hash,
                event_id,
                byte_count,
                chunk_count,
            } => (event_hash, event_id, byte_count, chunk_count),
            _ => return protocol_reject(sync_state.quarantine(), "Expected signed stone start"),
        };
        let expected_chunks = byte_count.div_ceil(EVENT_CHUNK_BYTES);
        if byte_count == 0
            || byte_count > MAX_EVENT_BYTES
            || chunk_count != expected_chunks
            || !expected.contains(&event_hash)
            || !seen.insert(event_hash.clone())
        {
            quarantine_protocol(
                sync_state.quarantine(),
                "Invalid or unrequested signed stone chunk set",
            );
            return Err("Rejected invalid signed stone chunk set".into());
        }
        let mut bytes = Vec::with_capacity(byte_count);
        for index in 0..chunk_count {
            let (received_hash, received_index, hex_data) = match channel
                .receive::<WireMessage>()?
            {
                WireMessage::EventChunk {
                    event_hash,
                    index,
                    hex_data,
                } => (event_hash, index, hex_data),
                _ => {
                    return protocol_reject(sync_state.quarantine(), "Expected signed stone chunk")
                }
            };
            if received_hash != event_hash || received_index != index {
                quarantine_protocol(
                    sync_state.quarantine(),
                    "Reordered or misidentified signed stone chunk",
                );
                return Err("Rejected reordered signed stone chunks".into());
            }
            let part = hex::decode(hex_data).map_err(|_| {
                quarantine_protocol(
                    sync_state.quarantine(),
                    "Malformed signed stone chunk encoding",
                )
            })?;
            if part.is_empty()
                || part.len() > EVENT_CHUNK_BYTES
                || bytes.len() + part.len() > byte_count
            {
                quarantine_protocol(
                    sync_state.quarantine(),
                    "Signed stone chunk exceeds declared bounds",
                );
                return Err("Rejected oversized signed stone chunk".into());
            }
            bytes.extend_from_slice(&part);
        }
        actual_total = actual_total.saturating_add(bytes.len());
        if bytes.len() != byte_count {
            quarantine_protocol(sync_state.quarantine(), "Signed stone byte count mismatch");
            return Err("Rejected truncated signed stone payload".into());
        }
        let event: JournalEvent = match serde_json::from_slice(&bytes) {
            Ok(event) => event,
            Err(error) => {
                quarantine_protocol(
                    sync_state.quarantine(),
                    &format!("Invalid signed stone JSON: {error}"),
                );
                *quarantined += 1;
                continue;
            }
        };
        if event.event_hash != event_hash || event.event_id != event_id {
            ingestion::quarantine_event(
                sync_state.quarantine(),
                &event,
                "Chunk header does not match signed stone",
            )?;
            *quarantined += 1;
            continue;
        }
        match ingest_event(journal, graph_state, sync_state, event) {
            Ok(IngestDisposition::Appended) => *received += 1,
            Ok(IngestDisposition::AlreadyKnown) => *duplicates += 1,
            Err(error) => {
                eprintln!("[citadel] quarantined incoming stone: {error}");
                *quarantined += 1;
            }
        }
    }
    if actual_total != total_bytes || seen != *expected {
        quarantine_protocol(
            sync_state.quarantine(),
            "Event transfer did not match declared total or Merkle diff",
        );
        return Err("Rejected incomplete event transfer".into());
    }
    Ok(())
}

fn receive_receipt(
    channel: &mut SecureChannel,
    quarantine: &QuarantineStore,
) -> Result<PeerReceipt, String> {
    match channel.receive::<WireMessage>()? {
        WireMessage::Receipt(receipt) => Ok(receipt),
        _ => protocol_reject(quarantine, "Expected peer convergence receipt"),
    }
}

fn protocol_reject<T>(quarantine: &QuarantineStore, reason: &str) -> Result<T, String> {
    Err(quarantine_protocol(quarantine, reason))
}

fn quarantine_protocol(quarantine: &QuarantineStore, reason: &str) -> String {
    let digest = blake3::hash(reason.as_bytes()).to_hex().to_string();
    let _ = quarantine.write_record(&format!("sync-protocol-{digest}.txt"), reason.as_bytes());
    let _ = quarantine.append_json_line(
        "conflicts.jsonl",
        &serde_json::json!({ "kind": "sync-protocol", "reason": reason }),
    );
    reason.to_string()
}

pub fn connect_to_peer(
    address: &str,
    journal: &JournalState,
    graph_state: &GraphState,
    semantic: &SemanticState,
    sync_state: &SyncState,
) -> Result<SyncReport, String> {
    let address = parse_local_address(address)?;
    let stream = TcpStream::connect_timeout(&address, Duration::from_secs(10))
        .map_err(|error| format!("Cannot connect to local Citadel peer: {error}"))?;
    exchange_stream(
        stream,
        HandshakeRole::Initiator,
        journal,
        graph_state,
        semantic,
        sync_state,
    )
}

pub fn accept_one_peer(
    bind_address: &str,
    journal: &JournalState,
    graph_state: &GraphState,
    semantic: &SemanticState,
    sync_state: &SyncState,
) -> Result<SyncReport, String> {
    let address = parse_local_address(bind_address)?;
    let listener = TcpListener::bind(address)
        .map_err(|error| format!("Cannot bind local Citadel sync listener: {error}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Cannot configure local Citadel sync listener: {error}"))?;
    let deadline = Instant::now() + Duration::from_secs(120);
    loop {
        match listener.accept() {
            Ok((stream, _peer)) => {
                return exchange_stream(
                    stream,
                    HandshakeRole::Responder,
                    journal,
                    graph_state,
                    semantic,
                    sync_state,
                )
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    return Err("No local Citadel peer connected within 120 seconds".into());
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => return Err(format!("Local sync listener failed: {error}")),
        }
    }
}

fn parse_local_address(address: &str) -> Result<SocketAddr, String> {
    let parsed: SocketAddr = address.parse().map_err(|_| {
        "Sync requires a literal IP:port address; hostnames and relays are disabled".to_string()
    })?;
    let ip = parsed.ip();
    let allowed = match ip {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_private() || ip.is_link_local(),
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || (ip.segments()[0] & 0xfe00) == 0xfc00
                || (ip.segments()[0] & 0xffc0) == 0xfe80
        }
    };
    if !allowed {
        return Err(
            "Sync transport accepts loopback, private LAN, or link-local addresses only".into(),
        );
    }
    Ok(parsed)
}

#[tauri::command]
pub fn sync_connect(
    address: String,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<SyncReport, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let graph_state = &services.graph;
    let semantic = &services.semantic;
    let sync_state = &services.sync;
    connect_to_peer(&address, &journal, &graph_state, &semantic, &sync_state)
}

#[tauri::command]
pub fn sync_accept_once(
    bind_address: String,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<SyncReport, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let graph_state = &services.graph;
    let semantic = &services.semantic;
    let sync_state = &services.sync;
    accept_one_peer(
        &bind_address,
        &journal,
        &graph_state,
        &semantic,
        &sync_state,
    )
}

#[tauri::command]
pub fn sync_derive_confirmation_phrase(
    peer_pubkey: String,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<String, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let sync_state = &services.sync;
    let local = sync_state.local_card()?.identity_pubkey;
    Ok(pairing::derive_confirmation_phrase(&local, &peer_pubkey))
}

#[tauri::command]
pub fn sync_export_stone_bundle(
    destination_path: Option<String>,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<bundle::BundleExportResult, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let path = destination_path.map(std::path::PathBuf::from);
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let sync_state = &services.sync;
    bundle::export_bundle(&journal, &sync_state, path)
}

#[tauri::command]
pub fn sync_import_stone_bundle(
    bundle_path: String,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<SyncReport, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let path = std::path::Path::new(&bundle_path);
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let graph_state = &services.graph;
    let semantic = &services.semantic;
    let sync_state = &services.sync;
    bundle::import_bundle(path, &journal, &graph_state, &semantic, &sync_state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::reconciliation::{build_summary, validate_inventory};

    #[test]
    fn merkle_inventory_and_missing_hash_ranges_are_stable() {
        let temp_a = tempfile::tempdir().unwrap();
        let temp_b = tempfile::tempdir().unwrap();
        let journal_a = JournalState::open_test(temp_a.path()).unwrap();
        let journal_b = JournalState::open_test(temp_b.path()).unwrap();
        let entry = |id: &str| crate::journal_log::JournalEntryInput {
            id: id.into(),
            day: "2026-10-14".into(),
            created_at: "now".into(),
            updated_at: "now".into(),
            text: id.into(),
            tags: vec![],
            metadata: Default::default(),
            timezone_offset: 0,
            level: None,
            period: None,
        };
        for i in 0..3 {
            journal_a.append_entry(entry(&format!("a{i}"))).unwrap();
        }
        journal_b.append_entry(entry("b0")).unwrap();
        let events_a = journal_a.verified_events().unwrap();
        let (summary, records) = build_summary(&events_a);
        validate_inventory(&summary, &records).unwrap();
        assert_eq!(summary.event_count, 3);
        assert_eq!(records.len(), 3);
        assert!(reconcile(&events_a, &[])
            .1
            .iter()
            .any(|range| range.count == 3));
        assert_ne!(
            root_for_events(&events_a),
            root_for_events(&journal_b.verified_events().unwrap())
        );
    }
}
