import type { Timestamp } from "firebase/firestore"

/** 245760 → "240 KB". Human-friendly file sizes for the resume list. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * Firestore Timestamp → "Jul 29, 2026". Returns "Just now" while the
 * serverTimestamp() is still resolving (null for a split second after upload).
 */
export function formatUploadedAt(timestamp: Timestamp | null): string {
  if (!timestamp) return "Just now"
  return timestamp.toDate().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
