use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

pub const DEFAULT_MODEL_NAME: &str = "qwen2.5-1.5b-instruct-q4_k_m.gguf";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerativeStatus {
    pub is_available: bool,
    pub model_name: String,
    pub backend: String,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunkPayload {
    pub token: String,
    pub finished: bool,
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
mod inner {
    use super::*;
    use llama_cpp_2::context::params::LlamaContextParams;
    use llama_cpp_2::llama_backend::LlamaBackend;
    use llama_cpp_2::llama_batch::LlamaBatch;
    use llama_cpp_2::model::params::LlamaModelParams;
    use llama_cpp_2::model::LlamaModel;
    use llama_cpp_2::sampling::LlamaSampler;
    use std::num::NonZeroU32;

    pub struct GenerativeEngine {
        model: Arc<LlamaModel>,
        backend: Arc<LlamaBackend>,
    }

    impl GenerativeEngine {
        pub fn load(model_path: &Path) -> Result<Self, String> {
            if !model_path.is_file() {
                return Err(format!("Model file not found at: {}", model_path.display()));
            }

            // Disable Metal residency sets to avoid GGML residency assert aborts on macOS exit
            std::env::set_var("GGML_METAL_NO_RESIDENCY", "1");

            let backend = Arc::new(
                LlamaBackend::init().map_err(|e| format!("Failed to init LlamaBackend: {e}"))?,
            );

            let model_params = LlamaModelParams::default();
            let model = LlamaModel::load_from_file(&backend, model_path, &model_params)
                .map_err(|e| format!("Failed to load GGUF model: {e}"))?;

            Ok(Self {
                model: Arc::new(model),
                backend,
            })
        }

        pub fn generate_with_callback<F>(
            &self,
            prompt: &str,
            max_tokens: usize,
            temperature: f32,
            mut on_token: F,
        ) -> Result<String, String>
        where
            F: FnMut(&str) -> bool, // returns false to stop early
        {
            let mut ctx_params = LlamaContextParams::default();
            ctx_params = ctx_params.with_n_ctx(NonZeroU32::new(2048));

            let mut ctx = self
                .model
                .new_context(&self.backend, ctx_params)
                .map_err(|e| format!("Failed to create context: {e}"))?;

            let vocab = self.model.vocab();
            let tokens = vocab.tokenize(prompt.as_bytes(), true, false);
            if tokens.is_empty() {
                return Err("Prompt produced zero tokens".to_string());
            }

            let mut batch = LlamaBatch::new(tokens.len().max(512), 1);
            for (i, token) in tokens.iter().enumerate() {
                batch
                    .add(*token, i as i32, &[0], i == tokens.len() - 1)
                    .map_err(|e| format!("Batch error: {e:?}"))?;
            }

            ctx.decode(&mut batch)
                .map_err(|e| format!("Decode error on prompt: {e}"))?;

            let mut sampler = if temperature <= 0.01 {
                LlamaSampler::greedy()
            } else {
                LlamaSampler::chain_simple([
                    LlamaSampler::temp(temperature),
                    LlamaSampler::top_p(0.9, 1),
                    LlamaSampler::dist(42),
                ])
            };

            let mut response_text = String::new();
            let mut current_pos = tokens.len() as i32;

            for _ in 0..max_tokens {
                let token = sampler.sample(&ctx, batch.n_tokens() - 1);
                sampler.accept(token);

                if vocab.is_eog(token) {
                    break;
                }

                let bytes = vocab.token_to_piece(token, false, None);
                let piece = String::from_utf8_lossy(&bytes);

                // Stop immediately if any control sequence or role marker is encountered
                let piece_trimmed = piece.trim();
                if piece_trimmed == "<|im_end|>"
                    || piece_trimmed == "<|im_start|>"
                    || piece_trimmed == "<|endoftext|>"
                    || piece_trimmed == "</s>"
                    || piece_trimmed.starts_with("<|im_")
                    || piece_trimmed.starts_with("<|end")
                {
                    break;
                }

                response_text.push_str(&piece);

                // If stop markers entered the stream, truncate and stop
                if response_text.contains("<|im_end|>")
                    || response_text.contains("<|im_start|>")
                    || response_text.contains("<|endoftext|>")
                    || response_text.contains("</s>")
                    || response_text.contains("\nPlayer:")
                    || response_text.contains("\nUser:")
                    || response_text.contains("\n/:")
                {
                    if let Some(idx) = response_text.find("<|") {
                        response_text.truncate(idx);
                    } else if let Some(idx) = response_text.find("</s>") {
                        response_text.truncate(idx);
                    } else if let Some(idx) = response_text.find("\nPlayer:") {
                        response_text.truncate(idx);
                    } else if let Some(idx) = response_text.find("\nUser:") {
                        response_text.truncate(idx);
                    } else if let Some(idx) = response_text.find("\n/:") {
                        response_text.truncate(idx);
                    }
                    break;
                }

                if !on_token(&piece) {
                    break;
                }

                batch.clear();
                batch
                    .add(token, current_pos, &[0], true)
                    .map_err(|e| format!("Batch error: {e:?}"))?;

                current_pos += 1;
                ctx.decode(&mut batch)
                    .map_err(|e| format!("Decode error on step: {e}"))?;
            }

            Ok(response_text)
        }
    }
}

pub struct GenerativeManager {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    engine: Mutex<Option<inner::GenerativeEngine>>,
    error: Mutex<Option<String>>,
    model_name: String,
}

impl GenerativeManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        let model_name = DEFAULT_MODEL_NAME.to_string();

        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            let model_path = resolve_model_path(app_handle, &model_name);
            match inner::GenerativeEngine::load(&model_path) {
                Ok(engine) => Self {
                    engine: Mutex::new(Some(engine)),
                    error: Mutex::new(None),
                    model_name,
                },
                Err(e) => {
                    eprintln!("[citadel] Generative Layer 2 model not active ({e})");
                    Self {
                        engine: Mutex::new(None),
                        error: Mutex::new(Some(e)),
                        model_name,
                    }
                }
            }
        }

        #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
        Self {
            error: Mutex::new(Some("Layer 2 generative engine is desktop macOS only".to_string())),
            model_name,
        }
    }

    pub fn status(&self) -> GenerativeStatus {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            let guard = self.engine.lock().unwrap();
            let is_available = guard.is_some();
            let err = self.error.lock().unwrap().clone();
            GenerativeStatus {
                is_available,
                model_name: self.model_name.clone(),
                backend: if is_available {
                    "Metal".to_string()
                } else {
                    "Unavailable".to_string()
                },
                error: err,
            }
        }

        #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
        GenerativeStatus {
            is_available: false,
            model_name: self.model_name.clone(),
            backend: "Unsupported Platform".to_string(),
            error: Some("Layer 2 requires macOS Apple Silicon".to_string()),
        }
    }

    pub fn generate_stream(
        &self,
        app: AppHandle,
        prompt: String,
        max_tokens: Option<usize>,
        temperature: Option<f32>,
    ) -> Result<String, String> {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            let guard = self
                .engine
                .lock()
                .map_err(|_| "Engine lock poisoned".to_string())?;
            let engine = guard
                .as_ref()
                .ok_or_else(|| "Generative model is unavailable".to_string())?;

            let max_tokens = max_tokens.unwrap_or(256).min(1024);
            let temperature = temperature.unwrap_or(0.7);

            let res = engine.generate_with_callback(&prompt, max_tokens, temperature, |piece| {
                if !piece.contains("<|") && !piece.contains("</s>") && !piece.contains("</p>") {
                    let _ = app.emit(
                        "sigma-voice-chunk",
                        StreamChunkPayload {
                            token: piece.to_string(),
                            finished: false,
                        },
                    );
                }
                true
            });

            let _ = app.emit(
                "sigma-voice-chunk",
                StreamChunkPayload {
                    token: String::new(),
                    finished: true,
                },
            );

            res
        }

        #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
        Err("Generative voice is not available on this platform".to_string())
    }

    /// Explicitly unloads the Generative Engine and frees all Metal GPU buffers.
    /// This prevents GGML residency assertion failures during static teardown on exit.
    pub fn unload(&self) {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            if let Ok(mut guard) = self.engine.lock() {
                if guard.is_some() {
                    *guard = None;
                }
            }
        }
    }
}

impl Drop for GenerativeManager {
    fn drop(&mut self) {
        self.unload();
    }
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
static ACTIVE_MANAGERS: Mutex<Vec<std::sync::Weak<GenerativeManager>>> = Mutex::new(Vec::new());

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
extern "C" {
    fn atexit(cb: extern "C" fn()) -> std::ffi::c_int;
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
extern "C" fn clean_exit_teardown() {
    if let Ok(mut list) = ACTIVE_MANAGERS.lock() {
        for weak in list.drain(..) {
            if let Some(mgr) = weak.upgrade() {
                mgr.unload();
            }
        }
    }
}

/// Registers an atexit hook to unload Metal resources when AppKit terminates the app via exit(0).
pub fn register_exit_teardown(mgr: &Arc<GenerativeManager>) {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        static HOOK_INIT: std::sync::Once = std::sync::Once::new();
        HOOK_INIT.call_once(|| {
            unsafe {
                atexit(clean_exit_teardown);
            }
        });
        if let Ok(mut list) = ACTIVE_MANAGERS.lock() {
            list.push(Arc::downgrade(mgr));
        }
    }
    #[cfg(not(all(target_os = "macos", target_arch = "aarch64")))]
    {
        let _ = mgr;
    }
}

fn resolve_model_path(app: &AppHandle, model_name: &str) -> PathBuf {
    // 1. Check inside app bundle resources
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundle_path = resource_dir.join("models").join("generative").join(model_name);
        if bundle_path.is_file() {
            return bundle_path;
        }
    }

    // 2. Check local dev root
    let dev_path = PathBuf::from("models").join("generative").join(model_name);
    if dev_path.is_file() {
        return dev_path;
    }

    // 3. Check AppData directory
    if let Ok(app_data) = app.path().app_data_dir() {
        let data_path = app_data.join("models").join("generative").join(model_name);
        if data_path.is_file() {
            return data_path;
        }
    }

    // Fallback to dev path
    dev_path
}
