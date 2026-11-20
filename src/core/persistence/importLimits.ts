export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;
export const MAX_IMPORTED_RECORDS = 10_000;
export const MAX_IMPORTED_FIELD_BYTES = 1024 * 1024;

export function assertImportByteLength(bytes: number, source: string, limit = MAX_IMPORT_BYTES): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit) {
    throw new Error(`${source} exceeds the ${limit}-byte import limit.`);
  }
}

export function assertImportTextSize(text: string, source: string, limit = MAX_IMPORT_BYTES): void {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > limit) throw new Error(`${source} exceeds the ${limit}-byte import limit.`);
  }
}

export function assertImportedField(value: string, field: string): void {
  assertImportTextSize(value, field, MAX_IMPORTED_FIELD_BYTES);
}
