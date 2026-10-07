import fs from "fs"
import os from "os"
import path from "path"

/** Flip the letter case of the final segment, e.g. `.../opencode-core-test-aB1` → `.../OPENCODE-CORE-TEST-Ab1`. */
export function caseVariant(directory: string) {
  const name = Array.from(path.basename(directory), (char) =>
    char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase(),
  ).join("")
  return path.join(path.dirname(directory), name)
}

// Case sensitivity is a property of the filesystem, not the OS: NTFS and default APFS fold case, while
// case-sensitive APFS, Windows per-directory case sensitivity, and ext4 casefold exist. Probe the volume
// that test directories are created on instead of branching on `process.platform`.
function probeCaseInsensitive() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "case-probe-"))
  try {
    const variant = fs.statSync(caseVariant(directory), { bigint: true, throwIfNoEntry: false })
    const original = fs.statSync(directory, { bigint: true })
    return variant !== undefined && variant.dev === original.dev && variant.ino === original.ino
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

export const caseInsensitiveTmp = probeCaseInsensitive()
