// Deterministic IDs let repeat ingests converge on the same logical records.
export function makeId(prefix: string, ...parts: Array<string | number>) {
  const normalized = parts.map((part) => String(part)).join(':')
  return `${prefix}_${hashString(normalized)}`
}

// FNV-1a is sufficient here because IDs only need stable compact hashing, not
// cryptographic guarantees.
export function hashString(value: string) {
  const bytes = new TextEncoder().encode(value)
  let hash = 2166136261

  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}
