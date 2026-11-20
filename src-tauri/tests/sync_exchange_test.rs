use citadel_lib::graph::{self, GraphState};
use citadel_lib::journal_log::{JournalEntryInput, JournalEvent, JournalState};
use citadel_lib::semantic_engine::SemanticState;
use citadel_lib::sync::exchange_stream;
use citadel_lib::sync::ingestion::ingest_event;
use citadel_lib::sync::quarantine::QuarantineStore;
use citadel_lib::sync::roster::SyncState;
use citadel_lib::sync::transport::{read_frame, HandshakeRole};
use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::net::{Shutdown, TcpListener, TcpStream};
use std::path::Path;
use std::thread;
use tempfile::TempDir;

struct EphemeralNode {
    _temp: TempDir,
    journal: JournalState,
    graph: GraphState,
    semantic: SemanticState,
    sync: SyncState,
}

impl EphemeralNode {
    fn new(label: &str) -> Self {
        let temp = tempfile::Builder::new().prefix(label).tempdir().unwrap();
        let key = citadel_lib::vault::initialize_or_unlock(
            temp.path(),
            "integration test vault passphrase",
        )
        .unwrap();
        let journal = JournalState::open_with_key(temp.path(), &key).unwrap();
        let graph = graph::open(&temp.path().join("citadel_graph"), &key).unwrap();
        let events = journal.verified_events().unwrap();
        let semantic = SemanticState::open(
            temp.path(),
            Path::new("/nonexistent/test-model.onnx"),
            Path::new("/nonexistent/test-vocab.txt"),
            &events,
            &key,
        );
        let sync = SyncState::open(temp.path(), &journal, &key).unwrap();
        Self {
            _temp: temp,
            journal,
            graph,
            semantic,
            sync,
        }
    }

    fn inscribe(&self, id: &str, text: &str) {
        self.journal
            .append_entry(JournalEntryInput {
                id: id.into(),
                day: "2026-10-14".into(),
                created_at: "2026-10-14T09:00:00-04:00".into(),
                updated_at: "2026-10-14T09:00:00-04:00".into(),
                text: text.into(),
                tags: vec!["sync-test".into()],
                metadata: Default::default(),
                timezone_offset: -240,
                level: None,
                period: None,
            })
            .unwrap();
    }

    fn pin(&self, other: &Self) {
        let other_card = other.sync.local_card().unwrap();
        self.sync
            .pin_device(other_card.identity_pubkey, other_card.noise_static_pubkey)
            .unwrap();
    }
}

#[test]
fn two_desktop_nodes_converge_over_loopback_tcp() {
    let node_a = EphemeralNode::new("citadel-node-a-");
    let node_b = EphemeralNode::new("citadel-node-b-");
    for index in 1..=5 {
        node_a.inscribe(&format!("a-{index}"), &format!("Node A stone {index}"));
    }
    for index in 1..=3 {
        node_b.inscribe(&format!("b-{index}"), &format!("Node B stone {index}"));
    }
    node_a.pin(&node_b);
    node_b.pin(&node_a);

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let server = thread::spawn(move || {
        let (stream, _) = listener.accept().unwrap();
        exchange_stream(
            stream,
            HandshakeRole::Responder,
            &node_b.journal,
            &node_b.graph,
            &node_b.semantic,
            &node_b.sync,
        )
        .map(|report| (report, node_b))
    });

    let client_stream = TcpStream::connect(address).unwrap();
    let report_a = exchange_stream(
        client_stream,
        HandshakeRole::Initiator,
        &node_a.journal,
        &node_a.graph,
        &node_a.semantic,
        &node_a.sync,
    )
    .unwrap();
    let (report_b, node_b) = server.join().unwrap().unwrap();
    let events_a = node_a.journal.verified_events().unwrap();
    let events_b = node_b.journal.verified_events().unwrap();
    let hashes_a = events_a
        .iter()
        .map(|event| event.event_hash.clone())
        .collect::<BTreeSet<_>>();
    let hashes_b = events_b
        .iter()
        .map(|event| event.event_hash.clone())
        .collect::<BTreeSet<_>>();

    assert_eq!(events_a.len(), 8);
    assert_eq!(events_b.len(), 8);
    assert_eq!(hashes_a, hashes_b);
    assert!(report_a.converged && report_b.converged);
    assert_eq!(report_a.local_merkle_root, report_b.local_merkle_root);
    assert!(report_a.received == 3 && report_b.received == 5);
    println!(
        "Node A converged: {} verified stones, root {}",
        events_a.len(),
        report_a.local_merkle_root
    );
    println!(
        "Node B converged: {} verified stones, root {}",
        events_b.len(),
        report_b.local_merkle_root
    );
}

#[test]
fn tampered_signature_is_quarantined_without_touching_the_log() {
    let node_a = EphemeralNode::new("citadel-tamper-source-");
    let node_b = EphemeralNode::new("citadel-tamper-target-");
    node_a.inscribe("tamper-source-entry", "original signed content");
    node_b.pin(&node_a);
    let mut tampered: JournalEvent = node_a.journal.verified_events().unwrap().remove(0);
    tampered.payload.text.push_str(" changed in transit");

    let result = ingest_event(&node_b.journal, &node_b.graph, &node_b.sync, tampered);
    assert!(result.is_err());
    assert_eq!(node_b.journal.verification().unwrap().event_count, 0);
    let conflict_log = String::from_utf8(
        node_b
            .sync
            .quarantine()
            .read_record("conflicts.jsonl")
            .unwrap(),
    )
    .unwrap();
    let lower_conflict = conflict_log.to_lowercase();
    assert!(
        lower_conflict.contains("hash mismatch")
            || lower_conflict.contains("signature verification failed")
    );
    assert!(fs::read_dir(node_b.sync.quarantine_dir())
        .unwrap()
        .next()
        .is_some());
    println!("Tampered stone rejected and quarantined; canonical log remains at 0 events");
}

#[test]
fn truncated_frame_is_rejected_and_quarantined() {
    let temp = tempfile::tempdir().unwrap();
    let quarantine = temp.path().join("quarantine");
    let key =
        citadel_lib::vault::initialize_or_unlock(temp.path(), "integration test vault passphrase")
            .unwrap();
    let quarantine_store = QuarantineStore::open(&quarantine, &key).unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let writer = thread::spawn(move || {
        let mut stream = TcpStream::connect(address).unwrap();
        stream.write_all(&8_u32.to_be_bytes()).unwrap();
        stream.write_all(&[1, 2, 3]).unwrap();
        stream.shutdown(Shutdown::Write).unwrap();
    });
    let (mut stream, _) = listener.accept().unwrap();
    let result = read_frame(&mut stream, &quarantine_store);
    writer.join().unwrap();
    assert!(result.is_err());
    let conflicts =
        String::from_utf8(quarantine_store.read_record("conflicts.jsonl").unwrap()).unwrap();
    assert!(conflicts.contains("truncated frame body"));
    let saved = fs::read_dir(&quarantine)
        .unwrap()
        .filter_map(Result::ok)
        .any(|item| item.path().extension().and_then(|ext| ext.to_str()) == Some("bin"));
    assert!(saved);
    println!("Truncated frame rejected and partial bytes retained in quarantine");
}
