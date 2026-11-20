use crate::sync::quarantine::QuarantineStore;
use crate::vault::{self, VaultKey};
use serde::de::DeserializeOwned;
use serde::Serialize;
use snow::{params::NoiseParams, Builder, HandshakeState, TransportState};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;

pub const MAX_FRAME_BYTES: usize = 64 * 1024;
pub const MAX_PLAINTEXT_BYTES: usize = MAX_FRAME_BYTES - 128;
const NOISE_PATTERN: &str = "Noise_XX_25519_ChaChaPoly_BLAKE2s";
const NOISE_KEY_FILE: &str = "noise_x25519.keypair";
const NOISE_KEY_AAD: &[u8] = b"citadel-noise-x25519-key-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandshakeRole {
    Initiator,
    Responder,
}

#[derive(Clone)]
pub struct NoiseIdentity {
    private_key: Vec<u8>,
    public_key: Vec<u8>,
}

impl NoiseIdentity {
    pub fn open(sync_dir: &Path, vault_key: &VaultKey) -> Result<Self, String> {
        fs::create_dir_all(sync_dir)
            .map_err(|error| format!("Cannot create sync storage directory: {error}"))?;
        let path = sync_dir.join(NOISE_KEY_FILE);
        if path.exists() {
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Cannot inspect Noise identity key: {error}"))?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err("Noise identity key must be a regular file".into());
            }
            let (bytes, was_legacy) =
                vault::read_encrypted_or_legacy(&path, vault_key, NOISE_KEY_AAD)?;
            if bytes.len() != 64 {
                return Err("Noise identity key file must be exactly 64 bytes".into());
            }
            if was_legacy {
                vault::write_encrypted(&path, &bytes, vault_key, NOISE_KEY_AAD)?;
            }
            return Ok(Self {
                private_key: bytes[..32].to_vec(),
                public_key: bytes[32..].to_vec(),
            });
        }

        let params = noise_params()?;
        let pair = Builder::new(params)
            .generate_keypair()
            .map_err(|error| format!("Cannot generate Noise identity: {error}"))?;
        let mut bytes = pair.private.clone();
        bytes.extend_from_slice(&pair.public);
        vault::write_encrypted(&path, &bytes, vault_key, NOISE_KEY_AAD)?;
        Ok(Self {
            private_key: pair.private,
            public_key: pair.public,
        })
    }

    pub fn public_key_hex(&self) -> String {
        hex::encode(&self.public_key)
    }

    pub fn public_key(&self) -> &[u8] {
        &self.public_key
    }
}

impl Drop for NoiseIdentity {
    fn drop(&mut self) {
        use zeroize::Zeroize;
        self.private_key.zeroize();
    }
}

pub struct SecureChannel {
    stream: TcpStream,
    noise: TransportState,
    quarantine: QuarantineStore,
    remote_noise_static: Vec<u8>,
}

impl SecureChannel {
    /// Completes Noise XX and confirms the remote static transport key appears
    /// in the locally pinned device roster before exposing the channel.
    pub fn establish(
        mut stream: TcpStream,
        role: HandshakeRole,
        identity: &NoiseIdentity,
        known_noise_keys: &[Vec<u8>],
        quarantine: &QuarantineStore,
    ) -> Result<Self, String> {
        stream
            .set_read_timeout(Some(Duration::from_secs(45)))
            .and_then(|_| stream.set_write_timeout(Some(Duration::from_secs(45))))
            .map_err(|error| format!("Cannot set sync socket timeouts: {error}"))?;

        let mut handshake = match role {
            HandshakeRole::Initiator => Builder::new(noise_params()?)
                .local_private_key(&identity.private_key)
                .build_initiator(),
            HandshakeRole::Responder => Builder::new(noise_params()?)
                .local_private_key(&identity.private_key)
                .build_responder(),
        }
        .map_err(|error| format!("Cannot initialize Noise XX: {error}"))?;

        let mut message = vec![0_u8; MAX_FRAME_BYTES];
        let mut output = vec![0_u8; MAX_FRAME_BYTES];
        match role {
            HandshakeRole::Initiator => {
                let written = handshake
                    .write_message(&[], &mut output)
                    .map_err(|error| format!("Noise handshake message 1 failed: {error}"))?;
                write_frame(&mut stream, &output[..written])?;
                read_handshake(&mut stream, &mut handshake, &mut message, quarantine)?;
                let written = handshake
                    .write_message(&[], &mut output)
                    .map_err(|error| format!("Noise handshake message 3 failed: {error}"))?;
                write_frame(&mut stream, &output[..written])?;
            }
            HandshakeRole::Responder => {
                read_handshake(&mut stream, &mut handshake, &mut message, quarantine)?;
                let written = handshake
                    .write_message(&[], &mut output)
                    .map_err(|error| format!("Noise handshake message 2 failed: {error}"))?;
                write_frame(&mut stream, &output[..written])?;
                read_handshake(&mut stream, &mut handshake, &mut message, quarantine)?;
            }
        }

        let remote_static = handshake
            .get_remote_static()
            .ok_or_else(|| "Noise XX did not provide a remote static key".to_string())?;
        if !known_noise_keys
            .iter()
            .any(|known| known.as_slice() == remote_static)
        {
            return Err("Unrecognized Noise identity; remote device is not pinned".into());
        }
        let remote_noise_static = remote_static.to_vec();
        let noise = handshake
            .into_transport_mode()
            .map_err(|error| format!("Noise XX transport setup failed: {error}"))?;
        Ok(Self {
            stream,
            noise,
            quarantine: quarantine.clone(),
            remote_noise_static,
        })
    }

    pub fn remote_noise_static(&self) -> &[u8] {
        &self.remote_noise_static
    }

    pub fn send<T: Serialize>(&mut self, value: &T) -> Result<(), String> {
        let plaintext = serde_json::to_vec(value)
            .map_err(|error| format!("Cannot encode sync message: {error}"))?;
        if plaintext.len() > MAX_PLAINTEXT_BYTES {
            return Err(format!(
                "Sync message exceeds the bounded frame payload limit ({} bytes)",
                MAX_PLAINTEXT_BYTES
            ));
        }
        let mut ciphertext = vec![0_u8; MAX_FRAME_BYTES];
        let written = self
            .noise
            .write_message(&plaintext, &mut ciphertext)
            .map_err(|error| format!("Cannot encrypt sync message: {error}"))?;
        write_frame(&mut self.stream, &ciphertext[..written])
    }

    pub fn receive<T: DeserializeOwned>(&mut self) -> Result<T, String> {
        let ciphertext = read_frame(&mut self.stream, &self.quarantine)?;
        let mut plaintext = vec![0_u8; MAX_FRAME_BYTES];
        let length = self
            .noise
            .read_message(&ciphertext, &mut plaintext)
            .map_err(|error| {
                quarantine_bytes(
                    &self.quarantine,
                    &ciphertext,
                    &format!("Noise authentication/decryption failed: {error}"),
                );
                format!("Rejected unauthenticated sync frame: {error}")
            })?;
        serde_json::from_slice(&plaintext[..length])
            .map_err(|error| format!("Invalid encrypted sync message: {error}"))
    }
}

fn read_handshake(
    stream: &mut TcpStream,
    handshake: &mut HandshakeState,
    message: &mut [u8],
    quarantine: &QuarantineStore,
) -> Result<(), String> {
    let framed = read_frame(stream, quarantine)?;
    let read = handshake
        .read_message(&framed, message)
        .map_err(|error| format!("Noise handshake authentication failed: {error}"))?;
    if read != 0 {
        return Err("Unexpected payload in Noise handshake".into());
    }
    Ok(())
}

fn noise_params() -> Result<NoiseParams, String> {
    NOISE_PATTERN
        .parse()
        .map_err(|error| format!("Invalid Noise protocol parameters: {error}"))
}

fn write_frame(writer: &mut impl Write, payload: &[u8]) -> Result<(), String> {
    if payload.is_empty() || payload.len() > MAX_FRAME_BYTES {
        return Err("Frame is empty or exceeds the 64 KiB transport limit".into());
    }
    let length = u32::try_from(payload.len())
        .map_err(|_| "Frame length does not fit its network prefix".to_string())?;
    writer
        .write_all(&length.to_be_bytes())
        .and_then(|_| writer.write_all(payload))
        .and_then(|_| writer.flush())
        .map_err(|error| format!("Cannot write bounded sync frame: {error}"))
}

/// Read one length-prefixed frame. Truncated or oversized frame bytes are
/// retained in local quarantine for diagnostics; they are never decoded.
pub fn read_frame(reader: &mut impl Read, quarantine: &QuarantineStore) -> Result<Vec<u8>, String> {
    let mut prefix = [0_u8; 4];
    read_exact_quarantined(reader, &mut prefix, quarantine, "truncated frame length")?;
    let length = u32::from_be_bytes(prefix) as usize;
    if length == 0 || length > MAX_FRAME_BYTES {
        quarantine_bytes(
            quarantine,
            &prefix,
            &format!("rejected frame length {length}"),
        );
        return Err(format!(
            "Frame length {length} is outside 1..={MAX_FRAME_BYTES}"
        ));
    }
    let mut bytes = vec![0_u8; length];
    read_exact_quarantined(reader, &mut bytes, quarantine, "truncated frame body")?;
    Ok(bytes)
}

fn read_exact_quarantined(
    reader: &mut impl Read,
    buffer: &mut [u8],
    quarantine: &QuarantineStore,
    reason: &str,
) -> Result<(), String> {
    let mut filled = 0;
    while filled < buffer.len() {
        match reader.read(&mut buffer[filled..]) {
            Ok(0) => {
                quarantine_bytes(quarantine, &buffer[..filled], reason);
                return Err(format!(
                    "Rejected {reason}: peer closed after {filled} bytes"
                ));
            }
            Ok(read) => filled += read,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => {
                quarantine_bytes(quarantine, &buffer[..filled], reason);
                return Err(format!("Rejected {reason}: {error}"));
            }
        }
    }
    Ok(())
}

pub(crate) fn quarantine_bytes(quarantine: &QuarantineStore, bytes: &[u8], reason: &str) {
    let digest = blake3::hash(bytes).to_hex().to_string();
    let _ = quarantine.write_record(&format!("frame-{digest}.bin"), bytes);
    let _ = quarantine.append_json_line(
        "conflicts.jsonl",
        &serde_json::json!({
            "kind": "transport-frame",
            "digest": digest,
            "byteCount": bytes.len(),
            "reason": reason,
        }),
    );
}
