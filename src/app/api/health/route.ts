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
  if (/client_email|clientEmail/i.test(message)) return "client-email-invalid"
  if (/project_id|projectId/i.test(message)) return "project-id-invalid"
  if (/credential/i.test(message)) return "credential-rejected"
  return "unknown-see-platform-logs"
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
  try {
    const { adminAuth } = await import("@/lib/firebase/admin")
    // Touch it so a lazily-thrown credential error surfaces now.
    await adminAuth.listUsers(1)
  } catch (error) {
    adminInit = "failed"
    reason = classify(error)
  }

  return NextResponse.json({ env, keyShape, adminInit, reason })
}
