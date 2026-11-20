# all-MiniLM-L6-v2 ONNX artifact

- Model: `sentence-transformers/all-MiniLM-L6-v2`, converted to quantized ONNX by Xenova.
- Source artifact: `Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx`.
- Pinned Hub revision: `751bff37182d3f1213fa05d7196b954e230abad9`.
- Model SHA-256: `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`.
- License: Apache-2.0; see `LICENSE`.
- The `vocab.txt` tokenizer vocabulary is from the same pinned Xenova revision.

The original model card specifies a 384-dimensional sentence embedding and
attention-mask-aware mean pooling followed by L2 normalization. Citadel performs
those operations in `src-tauri/src/semantic_engine.rs`.
