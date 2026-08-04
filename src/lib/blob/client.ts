/**
 * Blob storage — the ONLY file that names the storage vendor.
 *
 * Same discipline as `src/lib/ai/client.ts` naming the LLM provider once. Every
 * action and service imports these helpers instead of `@vercel/blob` directly,
 * so moving to S3, R2, or Supabase later is a change to THIS FILE and nothing
 * else. That seam has already paid off twice on this project (the Gemini model
 * migration, and moving off Firebase Storage in the first place).
 *
 * `server-only` is the guard: BLOB_READ_WRITE_TOKEN is a read-write credential
 * for the entire store — exactly as dangerous as the Firebase admin key — so
 * the build must fail if this is ever pulled into a browser bundle.
 */
import "server-only"
import { del, issueSignedToken, presignUrl } from "@vercel/blob"

/** Vercel injects this automatically in deployments once the store is linked. */
export const blobToken = process.env.BLOB_READ_WRITE_TOKEN

export const isBlobConfigured = Boolean(blobToken)

export function assertBlobConfigured(): void {
  if (!isBlobConfigured) {
    throw new Error(
      "Blob storage is not configured. Add BLOB_READ_WRITE_TOKEN to .env.local."
    )
  }
}

/** How long a preview link stays valid. Short on purpose — see below. */
const PREVIEW_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Mint a short-lived URL that lets the browser read ONE private blob.
 *
 * Why two steps: `issueSignedToken` creates a delegation scoped to a single
 * pathname and a single operation ("get"), then `presignUrl` turns that
 * delegation into an actual URL. The read-write token never leaves the server,
 * and the URL the browser receives can't be replayed against any other object.
 *
 * Why 5 minutes: a signed URL is a bearer credential — whoever holds it can
 * read the file, and a resume contains a real name, email, phone number, and
 * work history. A long TTL means a link pasted into a chat stays live for
 * hours. Short TTL keeps the blast radius small; the user just clicks again.
 *
 * ⚠️ Callers MUST verify ownership before calling this. This function trusts
 * its input completely — it has no idea who is asking.
 */
export async function createPreviewUrl(pathname: string): Promise<string> {
  assertBlobConfigured()

  const validUntil = Date.now() + PREVIEW_TTL_MS

  const signed = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    token: blobToken,
  })

  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname,
    access: "private",
  })

  return presignedUrl
}

/**
 * Delete a blob. Missing files are treated as success, because the goal is
 * "this file is gone" — and if it's already gone, we're done. Throwing here
 * would block the caller from cleaning up the matching Firestore document and
 * leave an orphaned row pointing at nothing.
 */
export async function deleteBlob(url: string): Promise<void> {
  assertBlobConfigured()
  try {
    await del(url, { token: blobToken })
  } catch (error) {
    const name = (error as { name?: string }).name
    if (name !== "BlobNotFoundError") throw error
  }
}
