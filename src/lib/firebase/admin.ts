/**
 * Firebase ADMIN SDK.
 *
 * This runs ONLY on the server (Server Actions, route handlers). It bypasses
 * security rules and can do trusted work: verifying a user's session token,
 * writing data on their behalf, reading across users for admin features.
 *
 * The `server-only` import is a guard: if this file is ever accidentally
 * imported into a Client Component, the build fails instead of leaking your
 * service-account private key into the browser bundle.
 */
import "server-only"
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

/**
 * Normalise the private key across every way it might be stored.
 *
 * 📌 This function exists because of a real production outage on this project.
 * The key was pasted into Vercel WITH the surrounding double quotes that
 * `.env.local` requires — quotes the dotenv parser strips but a dashboard
 * stores verbatim. `cert()` parses at import time, so it threw during module
 * load, which took down every route and Server Action that imports this file.
 * The symptom was a bare 500 with no error of ours in sight, because our
 * try/catch never got the chance to run.
 *
 * Three shapes have to work:
 *   - real newlines            (pasted multi-line into a dashboard)
 *   - literal \n sequences     (single-line, the .env convention)
 *   - either of those wrapped in single or double quotes
 *
 * Being forgiving here costs four lines and removes an entire class of deploy
 * failure that is miserable to diagnose from the outside.
 */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, "") // strip wrapping quotes if a dashboard kept them
    .replace(/\\n/g, "\n") // literal \n -> real line breaks
}

const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY)

// Fail with a message that names the problem, rather than letting `cert()`
// throw something generic from inside firebase-admin.
if (!privateKey?.includes("BEGIN PRIVATE KEY")) {
  throw new Error(
    "FIREBASE_ADMIN_PRIVATE_KEY is missing or malformed. It must contain the full PEM block, with no surrounding quotes."
  )
}

// Reuse the app across hot-reloads / serverless invocations.
const adminApp: App = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    })

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
