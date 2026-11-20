use crate::journal_log::JournalEvent;
use crate::vault::{self, VaultKey};
use ort::execution_providers::CoreMLExecutionProvider;
use ort::session::Session;
use ort::value::Tensor;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

const VECTOR_DIMENSIONS: usize = 384;
const MODEL_REVISION: &str = "751bff37182d3f1213fa05d7196b954e230abad9";
const MODEL_SHA256: &str = "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1";
const VOCAB_SHA256: &str = "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3";
#[cfg(test)]
const MODEL_FILE: &str = "model_quantized.onnx";
const INDEX_VERSION: u32 = 1;
const INDEX_FILE: &str = "semantic_index/index.json";
const MAX_TOKENS: usize = 256;
const MIN_SEMANTIC_SCORE: f32 = 0.20;
const INDEX_AAD: &[u8] = b"citadel-semantic-index-v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoredEntryMatch {
    pub id: String,
    pub event_id: String,
    pub source: String,
    pub timestamp: String,
    pub day: String,
    pub text: String,
    pub tags: Vec<String>,
    pub score: f32,
    pub method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticStatus {
    pub engine_available: bool,
    pub backend: String,
    pub model_revision: String,
    pub vector_dimensions: usize,
    pub indexed_entries: usize,
    pub index_current: bool,
    pub log_head_hash: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticTextInput {
    pub id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticPairScore {
    pub left_id: String,
    pub right_id: String,
    pub similarity: f32,
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexedVector {
    event_id: String,
    event_hash: String,
    vector: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexSnapshot {
    version: u32,
    model_revision: String,
    vector_dimensions: usize,
    log_head_hash: String,
    vectors: Vec<IndexedVector>,
}

impl IndexSnapshot {
    fn empty() -> Self {
        Self {
            version: INDEX_VERSION,
            model_revision: MODEL_REVISION.to_string(),
            vector_dimensions: VECTOR_DIMENSIONS,
            log_head_hash: log_head(&[]),
            vectors: Vec::new(),
        }
    }

    fn matches_log(&self, events: &[JournalEvent]) -> bool {
        let expected = events
            .iter()
            .filter(|event| eligible_event(event))
            .map(|event| (event.event_id.as_str(), event.event_hash.as_str()))
            .collect::<HashMap<_, _>>();
        self.version == INDEX_VERSION
            && self.model_revision == MODEL_REVISION
            && self.vector_dimensions == VECTOR_DIMENSIONS
            && self.log_head_hash == log_head(events)
            && self.vectors.len() == expected.len()
            && self.vectors.iter().all(|record| {
                expected.get(record.event_id.as_str()) == Some(&record.event_hash.as_str())
                    && record.vector.len() == VECTOR_DIMENSIONS
                    && record.vector.iter().all(|value| value.is_finite())
            })
    }
}

struct ModelEmbedder {
    session: Session,
    vocab: HashMap<String, i64>,
    backend: String,
}

impl ModelEmbedder {
    fn load(model_path: &Path, vocab_path: &Path) -> Result<Self, String> {
        if !model_path.is_file() || !vocab_path.is_file() {
            return Err("The bundled semantic model or vocabulary is missing".into());
        }
        verify_artifact_sha256(model_path, MODEL_SHA256)?;
        verify_artifact_sha256(vocab_path, VOCAB_SHA256)?;

        let vocab_file = fs::File::open(vocab_path)
            .map_err(|error| format!("Cannot open semantic vocabulary: {error}"))?;
        let vocab = BufReader::new(vocab_file)
            .lines()
            .enumerate()
            .map(|(index, line)| {
                line.map(|token| (token, index as i64))
                    .map_err(|error| format!("Cannot read semantic vocabulary: {error}"))
            })
            .collect::<Result<HashMap<_, _>, _>>()?;

        #[cfg(target_os = "macos")]
        let (session, backend) = {
            let coreml = Session::builder()
                .and_then(|builder| {
                    builder.with_execution_providers([CoreMLExecutionProvider::default()
                        .build()
                        .error_on_failure()])
                })
                .and_then(|builder| builder.commit_from_file(model_path));
            match coreml {
                Ok(session) => (session, "CoreML with CPU fallback".to_string()),
                Err(coreml_error) => {
                    let session = Session::builder()
                        .and_then(|builder| builder.commit_from_file(model_path))
                        .map_err(|cpu_error| {
                            format!(
                                "ONNX session unavailable (CoreML: {coreml_error}; CPU: {cpu_error})"
                            )
                        })?;
                    (session, "CPU fallback".to_string())
                }
            }
        };

        #[cfg(not(target_os = "macos"))]
        let (session, backend) = (
            Session::builder()
                .and_then(|builder| builder.commit_from_file(model_path))
                .map_err(|error| format!("Cannot load ONNX session: {error}"))?,
            "CPU".to_string(),
        );

        Ok(Self {
            session,
            vocab,
            backend,
        })
    }

    fn embed(&mut self, text: &str) -> Result<Vec<f32>, String> {
        if text.trim().is_empty() {
            return Err("Cannot embed empty text".into());
        }
        let token_ids = self.tokenize(text);
        if token_ids.is_empty() {
            return Err("Cannot embed empty text".into());
        }
        let sequence_len = token_ids.len();
        let attention_mask = vec![1_i64; sequence_len];
        let pooling_mask = attention_mask.clone();
        let token_type_ids = vec![0_i64; sequence_len];

        let outputs = self
            .session
            .run(ort::inputs! {
                "input_ids" => Tensor::from_array(([1_usize, sequence_len], token_ids))
                    .map_err(|error| error.to_string())?,
                "attention_mask" => Tensor::from_array(([1_usize, sequence_len], attention_mask))
                    .map_err(|error| error.to_string())?,
                "token_type_ids" => Tensor::from_array(([1_usize, sequence_len], token_type_ids))
                    .map_err(|error| error.to_string())?,
            })
            .map_err(|error| format!("Semantic inference failed: {error}"))?;

        let hidden = outputs[0]
            .try_extract_array::<f32>()
            .map_err(|error| format!("Cannot read semantic model output: {error}"))?;
        let shape = hidden.shape();
        if shape.len() != 3 || shape[0] != 1 || shape[2] != VECTOR_DIMENSIONS {
            return Err(format!("Unexpected MiniLM output shape: {shape:?}"));
        }

        let mut pooled = vec![0.0_f32; VECTOR_DIMENSIONS];
        let mut mask_count = 0.0_f32;
        for token_index in 0..shape[1].min(sequence_len) {
            if pooling_mask[token_index] == 0 {
                continue;
            }
            mask_count += 1.0;
            for dimension in 0..VECTOR_DIMENSIONS {
                pooled[dimension] += hidden[[0, token_index, dimension]];
            }
        }
        if mask_count == 0.0 {
            return Err("Semantic attention mask contains no tokens".into());
        }
        for component in &mut pooled {
            *component /= mask_count;
        }
        normalize(&mut pooled);
        Ok(pooled)
    }

    fn tokenize(&self, text: &str) -> Vec<i64> {
        let mut ids = vec![self.token_id("[CLS]")];
        for token in basic_tokens(text) {
            self.wordpiece(&token, &mut ids);
            if ids.len() >= MAX_TOKENS - 1 {
                break;
            }
        }
        ids.truncate(MAX_TOKENS - 1);
        ids.push(self.token_id("[SEP]"));
        ids
    }

    fn token_id(&self, token: &str) -> i64 {
        self.vocab.get(token).copied().unwrap_or(100)
    }

    fn wordpiece(&self, token: &str, output: &mut Vec<i64>) {
        let characters = token.chars().collect::<Vec<_>>();
        if characters.is_empty() {
            return;
        }
        if characters.len() > 100 {
            output.push(self.token_id("[UNK]"));
            return;
        }

        let mut start = 0;
        let mut pieces = Vec::new();
        let mut failed = false;
        while start < characters.len() {
            let mut end = characters.len();
            let mut found = None;
            while start < end {
                let mut candidate = characters[start..end].iter().collect::<String>();
                if start > 0 {
                    candidate.insert_str(0, "##");
                }
                if let Some(id) = self.vocab.get(&candidate) {
                    found = Some((*id, end));
                    break;
                }
                end -= 1;
            }
            match found {
                Some((id, end)) => {
                    pieces.push(id);
                    start = end;
                }
                None => {
                    failed = true;
                    break;
                }
            }
        }
        if failed {
            output.push(self.token_id("[UNK]"));
        } else {
            output.extend(pieces);
        }
    }
}

fn verify_artifact_sha256(path: &Path, expected: &str) -> Result<(), String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("Cannot read pinned semantic artifact {}: {error}", path.display()))?;
    let digest = hex::encode(Sha256::digest(&bytes));
    if digest != expected {
        return Err(format!("Pinned semantic artifact digest mismatch: {}", path.display()));
    }
    Ok(())
}

pub struct SemanticState {
    index_path: PathBuf,
    key: VaultKey,
    index: Mutex<IndexSnapshot>,
    model: Option<Mutex<ModelEmbedder>>,
    model_error: Option<String>,
    last_error: Mutex<Option<String>>,
}

impl SemanticState {
    pub fn open(
        app_data_dir: &Path,
        model_path: &Path,
        vocab_path: &Path,
        events: &[JournalEvent],
        key: &VaultKey,
    ) -> Self {
        let index_path = app_data_dir.join(INDEX_FILE);
        let (model, model_error) = match ModelEmbedder::load(model_path, vocab_path) {
            Ok(model) => (Some(Mutex::new(model)), None),
            Err(error) => (None, Some(error)),
        };

        let saved = read_index(&index_path, key)
            .ok()
            .filter(|index| index.matches_log(events));
        let state = Self {
            index_path,
            key: key.clone(),
            index: Mutex::new(saved.unwrap_or_else(IndexSnapshot::empty)),
            model,
            model_error,
            last_error: Mutex::new(None),
        };

        if state.model.is_some() && !state.index_is_current(events) {
            if let Err(error) = state.rebuild(events) {
                state.set_error(error);
            }
        }
        state
    }

    pub fn index_event(&self, event: &JournalEvent, events: &[JournalEvent]) -> Result<(), String> {
        let Some(model) = &self.model else {
            return Ok(());
        };
        let vector = if eligible_event(event) {
            let mut model = model
                .lock()
                .map_err(|_| "Semantic model lock poisoned".to_string())?;
            match model.embed(&index_text(event)) {
                Ok(vector) => Some(vector),
                Err(error) => {
                    self.set_error(Some(error.clone()));
                    return Err(error);
                }
            }
        } else {
            None
        };

        let mut index = self
            .index
            .lock()
            .map_err(|_| "Semantic index lock poisoned".to_string())?;
        if !events
            .iter()
            .any(|candidate| candidate.event_hash == event.event_hash)
        {
            return Err("Cannot index an event absent from the verified journal".into());
        }
        if let Some(vector) = vector {
            index
                .vectors
                .retain(|record| record.event_id != event.event_id);
            index.vectors.push(IndexedVector {
                event_id: event.event_id.clone(),
                event_hash: event.event_hash.clone(),
                vector,
            });
        }
        index.log_head_hash = log_head(events);
        write_index(&self.index_path, &index, &self.key)?;
        Ok(())
    }

    pub fn rebuild(&self, events: &[JournalEvent]) -> Result<(), String> {
        let Some(model) = &self.model else {
            return Err(self
                .model_error
                .clone()
                .unwrap_or_else(|| "Semantic model is unavailable".to_string()));
        };
        let mut model = model
            .lock()
            .map_err(|_| "Semantic model lock poisoned".to_string())?;
        let mut snapshot = IndexSnapshot::empty();
        for event in events.iter().filter(|event| eligible_event(event)) {
            snapshot.vectors.push(IndexedVector {
                event_id: event.event_id.clone(),
                event_hash: event.event_hash.clone(),
                vector: model.embed(&index_text(event))?,
            });
        }
        snapshot.log_head_hash = log_head(events);
        write_index(&self.index_path, &snapshot, &self.key)?;
        *self
            .index
            .lock()
            .map_err(|_| "Semantic index lock poisoned".to_string())? = snapshot;
        self.set_error(None);
        Ok(())
    }

    pub fn clear_index(&self) -> Result<(), String> {
        let mut index = self
            .index
            .lock()
            .map_err(|_| "Semantic index lock poisoned".to_string())?;
        *index = IndexSnapshot::empty();
        vault::remove_and_verify(&self.index_path)?;
        if let Some(parent) = self.index_path.parent() {
            if parent.exists() {
                vault::remove_and_verify(parent)?;
            }
        }
        self.set_error(None);
        Ok(())
    }

    pub fn search(
        &self,
        query: &str,
        top_k: usize,
        events: &[JournalEvent],
    ) -> Vec<ScoredEntryMatch> {
        if top_k == 0 || query.trim().is_empty() {
            return Vec::new();
        }
        let top_k = top_k.min(100);
        if self.model.is_some() && !self.index_is_current(events) {
            if let Err(error) = self.rebuild(events) {
                self.set_error(error);
            }
        }

        if let Some(model) = &self.model {
            let query_vector = match model.lock() {
                Ok(mut model) => match model.embed(query) {
                    Ok(vector) => Some(vector),
                    Err(error) => {
                        self.set_error(Some(error));
                        None
                    }
                },
                Err(_) => {
                    self.set_error(Some("Semantic model lock poisoned".into()));
                    None
                }
            };
            if let Some(query_vector) = query_vector {
                if let Some(matches) = self.semantic_matches(&query_vector, events, top_k) {
                    return matches;
                }
            }
        }
        keyword_search(query, events, top_k)
    }

    pub fn pair_scores(&self, items: &[SemanticTextInput]) -> Vec<SemanticPairScore> {
        let all_items = items;
        let items = items
            .iter()
            .filter(|item| !item.text.trim().is_empty())
            .collect::<Vec<_>>();
        if items.len() < 2 {
            return Vec::new();
        }
        let mut vectors = Vec::with_capacity(items.len());
        let (model, method) = if let Some(model) = &self.model {
            match model.lock() {
                Ok(mut model) => {
                    for item in &items {
                        match model.embed(&item.text) {
                            Ok(vector) => vectors.push(vector),
                            Err(error) => {
                                self.set_error(Some(error));
                                return lexical_pair_scores(all_items);
                            }
                        }
                    }
                    (Some(vectors), "semantic")
                }
                Err(_) => {
                    self.set_error(Some("Semantic model lock poisoned".into()));
                    return lexical_pair_scores(all_items);
                }
            }
        } else {
            return lexical_pair_scores(all_items);
        };

        let vectors = model.unwrap_or_default();
        let mut pairs = Vec::new();
        for left in 0..items.len() {
            for right in (left + 1)..items.len() {
                pairs.push(SemanticPairScore {
                    left_id: items[left].id.clone(),
                    right_id: items[right].id.clone(),
                    similarity: cosine(&vectors[left], &vectors[right]),
                    method: method.to_string(),
                });
            }
        }
        pairs
    }

    pub fn status(&self, events: &[JournalEvent]) -> SemanticStatus {
        let indexed_entries = self
            .index
            .lock()
            .map(|index| index.vectors.len())
            .unwrap_or(0);
        let backend = self
            .model
            .as_ref()
            .and_then(|model| model.lock().ok().map(|model| model.backend.clone()))
            .unwrap_or_else(|| "keyword fallback".to_string());
        SemanticStatus {
            engine_available: self.model.is_some(),
            backend,
            model_revision: MODEL_REVISION.to_string(),
            vector_dimensions: VECTOR_DIMENSIONS,
            indexed_entries,
            index_current: self.index_is_current(events),
            log_head_hash: log_head(events),
            last_error: self
                .last_error
                .lock()
                .ok()
                .and_then(|error| error.clone())
                .or_else(|| self.model_error.clone()),
        }
    }

    fn semantic_matches(
        &self,
        query_vector: &[f32],
        events: &[JournalEvent],
        top_k: usize,
    ) -> Option<Vec<ScoredEntryMatch>> {
        let index = self.index.lock().ok()?;
        if !index.matches_log(events) {
            return None;
        }
        let event_by_id = events
            .iter()
            .map(|event| (event.event_id.as_str(), event))
            .collect::<HashMap<_, _>>();
        let mut results = index
            .vectors
            .iter()
            .filter_map(|record| {
                let event = event_by_id.get(record.event_id.as_str())?;
                if event.event_hash != record.event_hash {
                    return None;
                }
                let score = cosine(query_vector, &record.vector);
                (score >= MIN_SEMANTIC_SCORE).then(|| match_event(event, score, "semantic"))
            })
            .collect::<Vec<_>>();
        results.sort_by(|left, right| right.score.total_cmp(&left.score));
        results.truncate(top_k);
        Some(results)
    }

    fn index_is_current(&self, events: &[JournalEvent]) -> bool {
        self.index
            .lock()
            .map(|index| index.matches_log(events))
            .unwrap_or(false)
    }

    fn set_error(&self, error: impl Into<Option<String>>) {
        if let Ok(mut current) = self.last_error.lock() {
            *current = error.into();
        }
    }
}

#[tauri::command]
pub fn semantic_search(
    query: String,
    top_k: usize,
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<Vec<ScoredEntryMatch>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let semantic = &services.semantic;
    let events = journal.verified_events()?;
    Ok(semantic.search(&query, top_k, &events))
}

#[tauri::command]
pub fn rebuild_semantic_index(
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<(), String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let semantic = &services.semantic;
    let events = journal.verified_events()?;
    match semantic.rebuild(&events) {
        Ok(()) => Ok(()),
        Err(error) => {
            semantic.set_error(Some(error.clone()));
            Err(error)
        }
    }
}

#[tauri::command]
pub fn get_semantic_status(
    runtime: tauri::State<'_, crate::VaultRuntime>,
) -> Result<SemanticStatus, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let semantic = &services.semantic;
    let events = journal.verified_events()?;
    Ok(semantic.status(&events))
}

#[tauri::command]
pub fn semantic_pair_scores(
    runtime: tauri::State<'_, crate::VaultRuntime>,
    items: Vec<SemanticTextInput>,
) -> Result<Vec<SemanticPairScore>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let semantic = &services.semantic;
    Ok(semantic.pair_scores(&items))
}

fn log_head(events: &[JournalEvent]) -> String {
    crate::sync::reconciliation::root_for_events(events)
}

fn eligible_event(event: &JournalEvent) -> bool {
    !event.payload.text.trim().is_empty()
        && !event.payload.tags.iter().any(|tag| {
            matches!(
                tag.as_str(),
                "non-inscription" | "derived-mindmap" | "system"
            )
        })
}

fn index_text(event: &JournalEvent) -> String {
    if event.payload.tags.is_empty() {
        event.payload.text.clone()
    } else {
        format!("{}\n{}", event.payload.text, event.payload.tags.join(" "))
    }
}

fn match_event(event: &JournalEvent, score: f32, method: &str) -> ScoredEntryMatch {
    let is_chat = event.payload.tags.iter().any(|t| t == "sigma-chat" || t == "chat-turn");
    ScoredEntryMatch {
        id: event.payload.entry_id.clone(),
        event_id: event.event_id.clone(),
        source: event
            .payload
            .migration_provenance
            .as_ref()
            .map(|provenance| provenance.source_refs.join(", "))
            .filter(|source| !source.is_empty())
            .unwrap_or_else(|| {
                if is_chat {
                    "chat.log".to_string()
                } else {
                    "journal.log".to_string()
                }
            }),
        timestamp: event.timestamp.clone(),
        day: event.payload.day.clone(),
        text: event.payload.text.clone(),
        tags: event.payload.tags.clone(),
        score,
        method: method.to_string(),
        level: event.payload.level.clone(),
        period: event.payload.period.clone(),
    }
}

fn keyword_search(query: &str, events: &[JournalEvent], top_k: usize) -> Vec<ScoredEntryMatch> {
    let query_terms = text_terms(query);
    if query_terms.is_empty() {
        return Vec::new();
    }
    let mut results = events
        .iter()
        .filter(|event| eligible_event(event))
        .filter_map(|event| {
            let entry_terms = text_terms(&event.payload.text);
            let tag_terms = event
                .payload
                .tags
                .iter()
                .flat_map(|tag| text_terms(tag))
                .collect::<HashSet<_>>();
            let text_matches = query_terms.intersection(&entry_terms).count();
            let tag_matches = query_terms.intersection(&tag_terms).count();
            let score = (text_matches as f32 / query_terms.len() as f32) * 0.8
                + (tag_matches as f32 / query_terms.len() as f32) * 0.2;
            (score > 0.0).then(|| match_event(event, score, "keyword"))
        })
        .collect::<Vec<_>>();
    results.sort_by(|left, right| right.score.total_cmp(&left.score));
    results.truncate(top_k);
    results
}

fn text_terms(text: &str) -> HashSet<String> {
    text.split(|character: char| !character.is_alphanumeric())
        .filter(|part| part.chars().count() > 2)
        .map(|part| part.to_lowercase())
        .collect()
}

fn lexical_pair_scores(items: &[SemanticTextInput]) -> Vec<SemanticPairScore> {
    let items = items
        .iter()
        .filter(|item| !item.text.trim().is_empty())
        .collect::<Vec<_>>();
    let terms = items
        .iter()
        .map(|item| text_terms(&item.text))
        .collect::<Vec<_>>();
    let mut pairs = Vec::new();
    for left in 0..items.len() {
        for right in (left + 1)..items.len() {
            let union = terms[left].union(&terms[right]).count();
            let intersection = terms[left].intersection(&terms[right]).count();
            pairs.push(SemanticPairScore {
                left_id: items[left].id.clone(),
                right_id: items[right].id.clone(),
                similarity: if union == 0 {
                    0.0
                } else {
                    intersection as f32 / union as f32
                },
                method: "keyword".to_string(),
            });
        }
    }
    pairs
}

fn basic_tokens(text: &str) -> Vec<String> {
    let normalized = text
        .nfkd()
        .filter(|character| !is_combining_mark(*character))
        .flat_map(char::to_lowercase)
        .collect::<String>();
    let mut result = Vec::new();
    let mut current = String::new();
    for character in normalized.chars() {
        if character.is_control() || character.is_whitespace() {
            if !current.is_empty() {
                result.push(std::mem::take(&mut current));
            }
        } else if character.is_alphanumeric() {
            current.push(character);
        } else {
            if !current.is_empty() {
                result.push(std::mem::take(&mut current));
            }
            result.push(character.to_string());
        }
    }
    if !current.is_empty() {
        result.push(current);
    }
    result
}

fn normalize(vector: &mut [f32]) {
    let norm = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
    if norm > f32::EPSILON {
        vector.iter_mut().for_each(|value| *value /= norm);
    }
}

fn cosine(left: &[f32], right: &[f32]) -> f32 {
    if left.len() != right.len() || left.len() != VECTOR_DIMENSIONS {
        return 0.0;
    }
    left.iter()
        .zip(right)
        .map(|(a, b)| a * b)
        .sum::<f32>()
        .clamp(-1.0, 1.0)
}

fn read_index(path: &Path, key: &VaultKey) -> Result<IndexSnapshot, String> {
    let (bytes, legacy) = vault::read_encrypted_or_legacy(path, key, INDEX_AAD)?;
    let snapshot: IndexSnapshot = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid semantic index: {error}"))?;
    if legacy {
        write_index(path, &snapshot, key)?;
    }
    Ok(snapshot)
}

fn write_index(path: &Path, index: &IndexSnapshot, key: &VaultKey) -> Result<(), String> {
    let bytes = serde_json::to_vec(index)
        .map_err(|error| format!("Cannot encode semantic index: {error}"))?;
    vault::write_encrypted(path, &bytes, key, INDEX_AAD)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal_log::{JournalEntryInput, JournalState};
    use std::collections::BTreeMap;
    use tempfile::tempdir;

    fn model_paths() -> (PathBuf, PathBuf) {
        let model_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("models/all-MiniLM-L6-v2");
        (model_dir.join(MODEL_FILE), model_dir.join("vocab.txt"))
    }

    #[test]
    fn cit_11_bundled_semantic_model_and_vocabulary_match_pinned_digests() {
        let (model_path, vocab_path) = model_paths();
        verify_artifact_sha256(&model_path, MODEL_SHA256).unwrap();
        verify_artifact_sha256(&vocab_path, VOCAB_SHA256).unwrap();

        let temp = tempdir().unwrap();
        let altered = temp.path().join("altered.onnx");
        fs::write(&altered, b"unverified model bytes").unwrap();
        assert!(verify_artifact_sha256(&altered, MODEL_SHA256)
            .unwrap_err()
            .contains("digest mismatch"));
    }

    fn append_text(journal: &JournalState, id: &str, day: &str, text: &str) {
        journal
            .append_entry(JournalEntryInput {
                id: id.into(),
                day: day.into(),
                created_at: format!("{day}T12:00:00.000Z"),
                updated_at: format!("{day}T12:00:00.000Z"),
                text: text.into(),
                tags: Vec::new(),
                metadata: BTreeMap::new(),
                timezone_offset: 0,
                level: None,
                period: None,
            })
            .expect("synthetic fixture should append to its temporary journal");
    }

    #[test]
    fn mini_lm_ranks_a_paraphrased_roof_leak_query() {
        let directory = tempdir().unwrap();
        let journal = JournalState::open_test(directory.path()).unwrap();
        append_text(
            &journal,
            "roof-leak",
            "2026-10-11",
            "The workshop roof leaked today.",
        );
        append_text(
            &journal,
            "brass-lamp",
            "2026-10-12",
            "I fixed the brass lamp after lunch.",
        );
        let events = journal.verified_events().unwrap();
        let (model_path, vocab_path) = model_paths();
        let semantic = SemanticState::open(
            directory.path(),
            &model_path,
            &vocab_path,
            &events,
            journal.vault_key(),
        );
        let matches = semantic.search("rain damage", 5, &events);

        let status = semantic.status(&events);
        assert!(
            status.engine_available,
            "ONNX model must load for semantic retrieval tests"
        );
        println!("semantic backend: {}", status.backend);
        println!(
            "semantic ranking: {}",
            matches
                .iter()
                .map(|entry| format!("{}={:.3}", entry.id, entry.score))
                .collect::<Vec<_>>()
                .join(", ")
        );
        assert_eq!(
            matches.first().map(|entry| entry.id.as_str()),
            Some("roof-leak"),
            "matches={matches:#?}"
        );
        assert_eq!(
            matches.first().map(|entry| entry.day.as_str()),
            Some("2026-10-11")
        );
        assert_eq!(
            matches.first().map(|entry| entry.method.as_str()),
            Some("semantic")
        );
    }

    #[test]
    fn corrupt_index_rebuilds_from_the_verified_journal() {
        let directory = tempdir().unwrap();
        let journal = JournalState::open_test(directory.path()).unwrap();
        append_text(
            &journal,
            "roof-leak",
            "2026-10-11",
            "The workshop roof leaked today.",
        );
        append_text(
            &journal,
            "brass-lamp",
            "2026-10-12",
            "I fixed the brass lamp after lunch.",
        );
        let events = journal.verified_events().unwrap();
        let (model_path, vocab_path) = model_paths();
        let semantic = SemanticState::open(
            directory.path(),
            &model_path,
            &vocab_path,
            &events,
            journal.vault_key(),
        );
        let path = directory.path().join(INDEX_FILE);
        fs::write(&path, b"corrupt disposable index").unwrap();

        semantic.rebuild(&events).unwrap();
        let encrypted_index = fs::read(directory.path().join(INDEX_FILE)).unwrap();
        assert!(encrypted_index.starts_with(b"CTVLT001"));
        let matches = semantic.search("rain damage", 3, &events);
        println!(
            "index rebuild: {} entries, current={}, top={}",
            semantic.status(&events).indexed_entries,
            semantic.status(&events).index_current,
            matches
                .first()
                .map(|entry| entry.id.as_str())
                .unwrap_or("none")
        );
        assert_eq!(semantic.status(&events).indexed_entries, 2);
        assert_eq!(
            matches.first().map(|entry| entry.id.as_str()),
            Some("roof-leak")
        );
        let (index_bytes, legacy) =
            vault::read_encrypted_or_legacy(&path, journal.vault_key(), INDEX_AAD).unwrap();
        assert!(!legacy);
        assert!(serde_json::from_slice::<IndexSnapshot>(&index_bytes).is_ok());
    }

    #[test]
    fn newly_appended_signed_entry_is_indexed_immediately() {
        let directory = tempdir().unwrap();
        let journal = JournalState::open_test(directory.path()).unwrap();
        let (model_path, vocab_path) = model_paths();
        let empty = journal.verified_events().unwrap();
        let semantic = SemanticState::open(
            directory.path(),
            &model_path,
            &vocab_path,
            &empty,
            journal.vault_key(),
        );
        let event = journal
            .append_entry(JournalEntryInput {
                id: "fresh-entry".into(),
                day: "2026-10-13".into(),
                created_at: "2026-10-13T12:00:00.000Z".into(),
                updated_at: "2026-10-13T12:00:00.000Z".into(),
                text: "The greenhouse glass rattled in the storm.".into(),
                tags: vec!["weather".into()],
                metadata: BTreeMap::new(),
                timezone_offset: 0,
                level: None,
                period: None,
            })
            .unwrap();
        let events = journal.verified_events().unwrap();
        semantic.index_event(&event, &events).unwrap();

        assert_eq!(semantic.status(&events).indexed_entries, 1);
        assert!(semantic.status(&events).index_current);
        assert_eq!(semantic.search("storm", 3, &events)[0].id, "fresh-entry");
    }

    #[test]
    fn missing_model_uses_exact_text_and_tag_fallback() {
        let directory = tempdir().unwrap();
        let journal = JournalState::open_test(directory.path()).unwrap();
        journal
            .append_entry(JournalEntryInput {
                id: "entry-1".into(),
                day: "2026-10-11".into(),
                created_at: "2026-10-11T12:00:00.000Z".into(),
                updated_at: "2026-10-11T12:00:00.000Z".into(),
                text: "Workshop roof repair after rain.".into(),
                tags: vec!["weather".into()],
                metadata: BTreeMap::new(),
                timezone_offset: 0,
                level: None,
                period: None,
            })
            .unwrap();
        let events = journal.verified_events().unwrap();
        let semantic = SemanticState::open(
            directory.path(),
            Path::new("missing-model.onnx"),
            Path::new("missing-vocab.txt"),
            &events,
            journal.vault_key(),
        );
        let matches = semantic.search("weather", 3, &events);
        assert_eq!(
            matches.first().map(|entry| entry.method.as_str()),
            Some("keyword")
        );
        assert_eq!(
            matches.first().map(|entry| entry.id.as_str()),
            Some("entry-1")
        );
    }

    #[test]
    fn cit_15_stale_semantic_records_are_not_returned_after_wipe_and_citations_keep_provenance() {
        let directory = tempdir().unwrap();
        let journal = JournalState::open_test(directory.path()).unwrap();
        let event = journal
            .append_entry(JournalEntryInput {
                id: "today-entry".into(),
                day: "2026-10-19".into(),
                created_at: "2026-10-19T10:11:12Z".into(),
                updated_at: "2026-10-19T10:11:12Z".into(),
                text: "Today I planted rosemary by the window.".into(),
                tags: vec!["today".into()],
                metadata: BTreeMap::new(),
                timezone_offset: 0,
                level: None,
                period: None,
            })
            .unwrap();
        let events = journal.verified_events().unwrap();
        let semantic = SemanticState::open(
            directory.path(),
            Path::new("missing-model.onnx"),
            Path::new("missing-vocab.txt"),
            &events,
            journal.vault_key(),
        );
        let match_before_wipe = semantic.search("rosemary", 5, &events);
        assert_eq!(match_before_wipe.len(), 1);
        assert_eq!(match_before_wipe[0].event_id, event.event_id);
        assert_eq!(match_before_wipe[0].source, "journal.log");
        assert_eq!(match_before_wipe[0].timestamp, event.timestamp);

        journal.reset_all().unwrap();
        semantic.clear_index().unwrap();
        let after_wipe = journal.verified_events().unwrap();
        assert!(semantic.search("rosemary", 5, &after_wipe).is_empty());
    }
}
