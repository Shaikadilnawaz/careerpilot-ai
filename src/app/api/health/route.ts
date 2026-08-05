/**
 * TEMPORARY diagnostic endpoint. Delete once the deployment is healthy.
 *
 * 📌 Why this exists: a module-load failure produces a bare 500 with no usable
 * information from outside, and we can't read the platform's logs from here.
 * This is the standard move in a real incident — add observability rather than
 * keep guessing.
 *
 * 📌 What it deliberately does NOT do: return any secret VALUE. Only booleans
 * ("is this variable set?"), a shape check on the key, and a coarse reason code
 * chosen from a fixed list. Raw exception text is never echoed, because an
 * exception can quote the input that caused it — which here would be key
 * material. That's the discipline that makes a diagnostic endpoint safe enough
 * to ship temporarily.
 */
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Map an unknown error to a fixed, safe code. Never returns raw text. */
function classify(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/missing or malformed/i.test(message)) return "our-guard-rejected-the-key"
  if (/Failed to parse private key|DECODER|asn1|PEM/i.test(message))
    return "private-key-unparseable"
  // The key parses fine but Google refuses it — almost always a REVOKED key
  // (deleted in the console after a rotation) or one belonging to a different
  // service account than the client_email claims.
  if (/invalid_grant|Invalid JWT Signature|invalid_client|account not found/i.test(message))
    return "key-parses-but-google-rejects-it (revoked or mismatched service account)"
  if (/PERMISSION_DENIED|insufficient|IAM/i.test(message))
    return "service-account-lacks-permission"
  if (/client_email|clientEmail/i.test(message)) return "client-email-invalid"
  if (/project_id|projectId/i.test(message)) return "project-id-invalid"
  if (/ENOTFOUND|ETIMEDOUT|network|fetch failed/i.test(message))
    return "network-error-reaching-google"
  if (/credential/i.test(message)) return "credential-rejected"
  return "unclassified"
}

/**
 * Aggressively redact anything that could be key material, then truncate.
 *
 * 📌 Long base64-ish runs are exactly what private keys, JWTs, and API tokens
 * look like — so we blank every run of 24+ token characters and any PEM block
 * outright. What survives is the prose part of the message, which is the part
 * that actually names the problem.
 */
function redact(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/-----BEGIN[\s\S]*?-----/g, "[PEM]")
    .replace(/[A-Za-z0-9+/=_.-]{24,}/g, "[REDACTED]")
    .slice(0, 300)
}

export async function GET() {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const stripped = key?.trim().replace(/^['"]|['"]$/g, "")

  const env = {
    FIREBASE_ADMIN_PROJECT_ID: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
    FIREBASE_ADMIN_CLIENT_EMAIL: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    FIREBASE_ADMIN_PRIVATE_KEY: Boolean(key),
    GOOGLE_GENERATIVE_AI_API_KEY: Boolean(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ),
    BLOB_READ_WRITE_TOKEN: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ),
  }

  // Shape facts about the key that give away nothing about its contents.
  const keyShape = {
    length: key?.length ?? 0,
    hadWrappingQuotes: Boolean(key && /^['"]|['"]$/.test(key.trim())),
    hasPemHeader: Boolean(stripped?.includes("BEGIN PRIVATE KEY")),
    hasLiteralBackslashN: Boolean(key?.includes("\\n")),
    hasRealNewlines: Boolean(key?.includes("\n")),
  }

  // Import the admin module lazily so a throw here is CAUGHT rather than
  // taking this route down the same way it took the upload route down.
  let adminInit = "ok"
  let reason: string | undefined
  let detail: string | undefined
  try {
    const { adminAuth } = await import("@/lib/firebase/admin")
    // Touch it so a lazily-thrown credential error surfaces now.
    await adminAuth.listUsers(1)
  } catch (error) {
    adminInit = "failed"
    reason = classify(error)
    detail = redact(error)
  }

  // Which service account the credentials CLAIM to be. The local part of an
  // email address is not a secret, and matching it against the Firebase console
  // is the fastest way to spot a stale key from a previous rotation.
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? ""
  const identity = {
    projectIdMatchesPublic:
      process.env.FIREBASE_ADMIN_PROJECT_ID ===
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmailDomain: clientEmail.split("@")[1] ?? "",
  }

  /**
   * 📌 The runtime facts. Added after three wrong hypotheses: the ERR_REQUIRE_ESM
   * failure points at Node's module system, and `require()` of an ES module was
   * only unflagged in Node 22.12 — so the actual version is the single most
   * decisive fact available, and I had been assuming it instead of reading it.
   */
  const runtimeInfo = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    // Anything below 22.12 cannot require() an ES module.
    supportsRequireEsm: (() => {
      const [major, minor] = process.version
        .replace(/^v/, "")
        .split(".")
        .map(Number)
      return major > 22 || (major === 22 && minor >= 12)
    })(),
  }

  return NextResponse.json({
    runtimeInfo,
    env,
    keyShape,
    identity,
    adminInit,
    reason,
    detail,
  })
}
