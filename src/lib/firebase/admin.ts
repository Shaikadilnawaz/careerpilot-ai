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

// Reuse the app across hot-reloads / serverless invocations.
const adminApp: App = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Env vars can't hold real newlines, so the private key is stored with
        // literal "\n" sequences that we convert back to actual line breaks.
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    })

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
