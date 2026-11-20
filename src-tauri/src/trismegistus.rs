use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub const TRIS_MAGIC: &[u8; 4] = b"TRIS";
pub const TRIS_VERSION: u16 = 1;
pub const HEADER_SIZE: usize = 64;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlatformOrigin {
    Unknown = 0,
    IOS = 1,
    MacOS = 2,
    Linux = 3,
    Windows = 4,
    Android = 5,
}

impl PlatformOrigin {
    pub fn current() -> Self {
        if cfg!(target_os = "linux") {
            PlatformOrigin::Linux
        } else if cfg!(target_os = "windows") {
            PlatformOrigin::Windows
        } else if cfg!(target_os = "macos") {
            PlatformOrigin::MacOS
        } else if cfg!(target_os = "ios") {
            PlatformOrigin::IOS
        } else if cfg!(target_os = "android") {
            PlatformOrigin::Android
        } else {
            PlatformOrigin::Unknown
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrismegistusMetadata {
    pub schema_id: String,
    pub engine_version: String,
    pub device_name: Option<String>,
    pub custom_tags: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone)]
pub struct TrismegistusPackage<T> {
    pub metadata: TrismegistusMetadata,
    pub state: T,
}

#[derive(Debug)]
pub enum TrismegistusError {
    InvalidMagic,
    TooShort,
    ChecksumMismatch { expected: u32, actual: u32 },
    Serialization(String),
    Deserialization(String),
}

impl std::fmt::Display for TrismegistusError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for TrismegistusError {}

impl<T: Serialize + for<'de> Deserialize<'de>> TrismegistusPackage<T> {
    pub fn new(metadata: TrismegistusMetadata, state: T) -> Self {
        Self { metadata, state }
    }

    /// Serializes the package into the .trismegistus binary format.
    pub fn serialize(&self) -> Result<Vec<u8>, TrismegistusError> {
        let meta_bytes = serde_json::to_vec(&self.metadata)
            .map_err(|e| TrismegistusError::Serialization(e.to_string()))?;
        let state_bytes = serde_json::to_vec(&self.state)
            .map_err(|e| TrismegistusError::Serialization(e.to_string()))?;

        let meta_offset = HEADER_SIZE as u64;
        let meta_len = u32::try_from(meta_bytes.len())
            .map_err(|_| TrismegistusError::Serialization("metadata too large".into()))?;
        let payload_offset = meta_offset + meta_len as u64;
        let payload_len = state_bytes.len() as u64;

        let checksum = crc32_ieee(&[&meta_bytes, &state_bytes]);

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let mut out = Vec::with_capacity(HEADER_SIZE + meta_bytes.len() + state_bytes.len());

        // Fixed 64-byte header (little-endian)
        out.extend_from_slice(TRIS_MAGIC); // 0..4
        out.extend_from_slice(&TRIS_VERSION.to_le_bytes()); // 4..6
        out.extend_from_slice(&0u16.to_le_bytes()); // 6..8 flags
        out.push(PlatformOrigin::current() as u8); // 8 platform
        out.extend_from_slice(&[0u8; 3]); // 9..12 reserved
        out.extend_from_slice(&timestamp.to_le_bytes()); // 12..20
        out.extend_from_slice(&meta_offset.to_le_bytes()); // 20..28
        out.extend_from_slice(&meta_len.to_le_bytes()); // 28..32
        out.extend_from_slice(&payload_offset.to_le_bytes()); // 32..40
        out.extend_from_slice(&payload_len.to_le_bytes()); // 40..48
        out.extend_from_slice(&payload_len.to_le_bytes()); // 48..56 uncompressed
        out.extend_from_slice(&checksum.to_le_bytes()); // 56..60
        out.extend_from_slice(&[0u8; 4]); // 60..64 padding

        out.extend_from_slice(&meta_bytes);
        out.extend_from_slice(&state_bytes);

        Ok(out)
    }

    /// Deserializes a .trismegistus binary slice into metadata and state.
    pub fn deserialize(bytes: &[u8]) -> Result<Self, TrismegistusError> {
        if bytes.len() < HEADER_SIZE {
            return Err(TrismegistusError::TooShort);
        }
        if &bytes[0..4] != TRIS_MAGIC {
            return Err(TrismegistusError::InvalidMagic);
        }

        let rd_u64 = |r: std::ops::Range<usize>| {
            u64::from_le_bytes(bytes[r].try_into().expect("fixed header range"))
        };
        let m_off = rd_u64(20..28);
        let m_len = u32::from_le_bytes(bytes[28..32].try_into().expect("fixed header range")) as u64;
        let p_off = rd_u64(32..40);
        let p_len = rd_u64(40..48);
        let expected_crc = u32::from_le_bytes(bytes[56..60].try_into().expect("fixed header range"));

        let slice = |off: u64, len: u64| -> Result<&[u8], TrismegistusError> {
            let end = off.checked_add(len).ok_or(TrismegistusError::TooShort)?;
            if off < HEADER_SIZE as u64 || end > bytes.len() as u64 {
                return Err(TrismegistusError::TooShort);
            }
            Ok(&bytes[off as usize..end as usize])
        };
        let meta_slice = slice(m_off, m_len)?;
        let state_slice = slice(p_off, p_len)?;

        let actual_crc = crc32_ieee(&[meta_slice, state_slice]);
        if actual_crc != expected_crc {
            return Err(TrismegistusError::ChecksumMismatch {
                expected: expected_crc,
                actual: actual_crc,
            });
        }

        let metadata: TrismegistusMetadata = serde_json::from_slice(meta_slice)
            .map_err(|e| TrismegistusError::Deserialization(e.to_string()))?;
        let state: T = serde_json::from_slice(state_slice)
            .map_err(|e| TrismegistusError::Deserialization(e.to_string()))?;

        Ok(Self { metadata, state })
    }
}

/// IEEE 802.3 CRC32 over the concatenation of the given chunks.
fn crc32_ieee(chunks: &[&[u8]]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in chunks.iter().flat_map(|c| c.iter()) {
        crc ^= b as u32;
        for _ in 0..8 {
            crc = if (crc & 1) != 0 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Serialize, Deserialize, PartialEq, Debug)]
    struct TestState {
        player_name: String,
        coordinates: (f32, f32, f32),
        score: u64,
    }

    fn sample() -> TrismegistusPackage<TestState> {
        TrismegistusPackage::new(
            TrismegistusMetadata {
                schema_id: "test.state.v1".into(),
                engine_version: "0.1.0".into(),
                device_name: Some("DevMachine".into()),
                custom_tags: None,
            },
            TestState {
                player_name: "Sigma".into(),
                coordinates: (10.0, 20.5, -5.0),
                score: 42000,
            },
        )
    }

    #[test]
    fn test_roundtrip_serialization() {
        let pkg = sample();
        let bytes = pkg.serialize().expect("serialization should succeed");
        let decoded: TrismegistusPackage<TestState> =
            TrismegistusPackage::deserialize(&bytes).expect("deserialization should succeed");
        assert_eq!(decoded.state, pkg.state);
        assert_eq!(decoded.metadata.schema_id, "test.state.v1");
    }

    #[test]
    fn crc32_known_vector() {
        assert_eq!(crc32_ieee(&[b"123456789"]), 0xCBF4_3926);
    }

    #[test]
    fn rejects_corruption_and_malformed_headers() {
        let mut bytes = sample().serialize().unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0xFF;
        assert!(matches!(
            TrismegistusPackage::<TestState>::deserialize(&bytes),
            Err(TrismegistusError::ChecksumMismatch { .. })
        ));

        let mut bytes = sample().serialize().unwrap();
        bytes[32..40].copy_from_slice(&u64::MAX.to_le_bytes());
        assert!(matches!(
            TrismegistusPackage::<TestState>::deserialize(&bytes),
            Err(TrismegistusError::TooShort)
        ));

        assert!(matches!(
            TrismegistusPackage::<TestState>::deserialize(b"NOPE"),
            Err(TrismegistusError::TooShort)
        ));
    }
}
