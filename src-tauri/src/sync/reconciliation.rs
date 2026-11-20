use crate::journal_log::{JournalEvent, GENESIS_HASH};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub const HASH_RECORDS_PER_PART: usize = 96;
pub const MAX_SUMMARY_ENTRIES: usize = 1_000_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HashRecord {
    pub author_pubkey: String,
    pub event_id: String,
    pub parent_hash: String,
    pub event_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceMerkleHead {
    pub author_pubkey: String,
    pub count: usize,
    pub head_hash: String,
    pub merkle_root: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MerkleSummary {
    pub event_count: usize,
    pub merkle_root: String,
    pub devices: Vec<DeviceMerkleHead>,
    pub part_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingEventRange {
    pub author_pubkey: String,
    pub from_index: usize,
    pub count: usize,
    pub first_parent_hash: String,
    pub last_event_hash: String,
}

pub fn build_summary(events: &[JournalEvent]) -> (MerkleSummary, Vec<HashRecord>) {
    let mut by_author = BTreeMap::<String, Vec<&JournalEvent>>::new();
    for event in events {
        by_author
            .entry(event.author_pubkey.clone())
            .or_default()
            .push(event);
    }

    let devices = by_author
        .iter()
        .map(|(author, chain)| {
            let hashes = chain
                .iter()
                .map(|event| event.event_hash.clone())
                .collect::<Vec<_>>();
            DeviceMerkleHead {
                author_pubkey: author.clone(),
                count: chain.len(),
                head_hash: hashes
                    .last()
                    .cloned()
                    .unwrap_or_else(|| GENESIS_HASH.to_string()),
                merkle_root: merkle_root(&hashes),
            }
        })
        .collect::<Vec<_>>();
    let mut records = events
        .iter()
        .map(|event| HashRecord {
            author_pubkey: event.author_pubkey.clone(),
            event_id: event.event_id.clone(),
            parent_hash: event.parent_hash.clone(),
            event_hash: event.event_hash.clone(),
        })
        .collect::<Vec<_>>();
    // Stable grouping by author preserves the signed previous-hash order in
    // each per-device chain while keeping inventory parts deterministic.
    records.sort_by(|left, right| left.author_pubkey.cmp(&right.author_pubkey));
    let mut sorted_hashes = records
        .iter()
        .map(|record| record.event_hash.clone())
        .collect::<Vec<_>>();
    sorted_hashes.sort();
    let part_count = records.len().div_ceil(HASH_RECORDS_PER_PART);
    (
        MerkleSummary {
            event_count: events.len(),
            merkle_root: merkle_root(&sorted_hashes),
            devices,
            part_count,
        },
        records,
    )
}

pub fn validate_inventory(summary: &MerkleSummary, records: &[HashRecord]) -> Result<(), String> {
    if summary.event_count > MAX_SUMMARY_ENTRIES
        || records.len() != summary.event_count
        || records.len().div_ceil(HASH_RECORDS_PER_PART) != summary.part_count
    {
        return Err("Peer Merkle inventory count is inconsistent or too large".into());
    }
    let mut by_author = BTreeMap::<&str, Vec<&HashRecord>>::new();
    let mut hashes = BTreeSet::new();
    let mut ids = BTreeSet::new();
    for record in records {
        if !hashes.insert(record.event_hash.as_str()) {
            return Err("Peer Merkle inventory repeats an event hash".into());
        }
        if !ids.insert(record.event_id.as_str()) {
            return Err("Peer Merkle inventory repeats an event ID".into());
        }
        by_author
            .entry(record.author_pubkey.as_str())
            .or_default()
            .push(record);
    }

    let mut observed_devices = Vec::new();
    for (author, chain_records) in by_author {
        let mut parent = GENESIS_HASH;
        let mut chain_hashes = Vec::with_capacity(chain_records.len());
        let mut seen_children = BTreeSet::new();
        for record in chain_records {
            if record.parent_hash != parent {
                return Err(format!(
                    "Peer inventory contains a fork or gap for author {author}"
                ));
            }
            if !seen_children.insert(record.parent_hash.as_str()) {
                return Err(format!(
                    "Peer inventory forks at parent {}",
                    record.parent_hash
                ));
            }
            parent = record.event_hash.as_str();
            chain_hashes.push(record.event_hash.clone());
        }
        observed_devices.push(DeviceMerkleHead {
            author_pubkey: author.to_string(),
            count: chain_hashes.len(),
            head_hash: parent.to_string(),
            merkle_root: merkle_root(&chain_hashes),
        });
    }
    observed_devices.sort_by(|left, right| left.author_pubkey.cmp(&right.author_pubkey));
    let mut expected_devices = summary.devices.clone();
    expected_devices.sort_by(|left, right| left.author_pubkey.cmp(&right.author_pubkey));
    if observed_devices != expected_devices {
        return Err("Peer device heads do not match the Merkle inventory".into());
    }
    let mut sorted_hashes = records
        .iter()
        .map(|record| record.event_hash.clone())
        .collect::<Vec<_>>();
    sorted_hashes.sort();
    if merkle_root(&sorted_hashes) != summary.merkle_root {
        return Err("Peer BLAKE3 Merkle root does not match its inventory".into());
    }
    Ok(())
}

/// Return missing source stones in parent-before-child order, and describe
/// missing contiguous suffixes for each author chain.
pub fn reconcile(
    local_events: &[JournalEvent],
    peer_records: &[HashRecord],
) -> (Vec<JournalEvent>, Vec<MissingEventRange>) {
    let peer_hashes = peer_records
        .iter()
        .map(|record| record.event_hash.as_str())
        .collect::<BTreeSet<_>>();
    let local_hashes = local_events
        .iter()
        .map(|event| event.event_hash.as_str())
        .collect::<BTreeSet<_>>();
    let missing = local_events
        .iter()
        .filter(|event| !peer_hashes.contains(event.event_hash.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let ranges = missing_ranges(local_events, peer_records);
    let _remote_missing = peer_records
        .iter()
        .filter(|record| !local_hashes.contains(record.event_hash.as_str()))
        .count();
    (missing, ranges)
}

pub fn expected_incoming(
    local_events: &[JournalEvent],
    peer_records: &[HashRecord],
) -> BTreeSet<String> {
    let local_hashes = local_events
        .iter()
        .map(|event| event.event_hash.as_str())
        .collect::<BTreeSet<_>>();
    peer_records
        .iter()
        .filter(|record| !local_hashes.contains(record.event_hash.as_str()))
        .map(|record| record.event_hash.clone())
        .collect()
}

pub fn root_for_events(events: &[JournalEvent]) -> String {
    let mut hashes = events
        .iter()
        .map(|event| event.event_hash.clone())
        .collect::<Vec<_>>();
    hashes.sort();
    merkle_root(&hashes)
}

fn missing_ranges(
    local_events: &[JournalEvent],
    peer_records: &[HashRecord],
) -> Vec<MissingEventRange> {
    let mut local_by_author = BTreeMap::<String, Vec<&JournalEvent>>::new();
    let mut peer_by_author = BTreeMap::<String, Vec<&HashRecord>>::new();
    for event in local_events {
        local_by_author
            .entry(event.author_pubkey.clone())
            .or_default()
            .push(event);
    }
    for record in peer_records {
        peer_by_author
            .entry(record.author_pubkey.clone())
            .or_default()
            .push(record);
    }
    let mut ranges = Vec::new();
    for (author, local_chain) in local_by_author {
        let peer_chain = peer_by_author.get(&author).cloned().unwrap_or_default();
        let common_prefix = local_chain
            .iter()
            .zip(peer_chain.iter())
            .take_while(|(local, peer)| local.event_hash == peer.event_hash)
            .count();
        if common_prefix < local_chain.len() {
            let missing = &local_chain[common_prefix..];
            if let Some(last) = missing.last() {
                ranges.push(MissingEventRange {
                    author_pubkey: author,
                    from_index: common_prefix,
                    count: missing.len(),
                    first_parent_hash: missing[0].parent_hash.clone(),
                    last_event_hash: last.event_hash.clone(),
                });
            }
        }
    }
    ranges
}

fn merkle_root(hashes: &[String]) -> String {
    if hashes.is_empty() {
        return blake3::hash(b"citadel-m3-empty-merkle")
            .to_hex()
            .to_string();
    }
    let mut level = hashes
        .iter()
        .map(|hash| {
            let mut hasher = blake3::Hasher::new();
            hasher.update(&[0]);
            hasher.update(hash.as_bytes());
            *hasher.finalize().as_bytes()
        })
        .collect::<Vec<_>>();
    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            let right = pair.get(1).unwrap_or(&pair[0]);
            let mut hasher = blake3::Hasher::new();
            hasher.update(&[1]);
            hasher.update(&pair[0]);
            hasher.update(right);
            next.push(*hasher.finalize().as_bytes());
        }
        level = next;
    }
    hex::encode(level[0])
}
