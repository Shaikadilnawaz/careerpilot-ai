/**
 * Firebase CLIENT SDK.
 *
 * This runs in the browser (and in Client Components). It handles anything the
 * user's session needs directly: signing in, uploading files, live listeners.
 * The config values are public by design — real security lives in your
 * Firestore/Storage rules, NOT in hiding these keys.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getStorage, type FirebaseStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/**
 * True only when the essential keys exist. Until you fill in `.env.local`, we
 * skip initialization so the app can still render its UI instead of crashing
 * with a cryptic "auth/invalid-api-key". The AuthProvider and auth-service
 * both check this flag before using Firebase.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
)

// Next.js hot-reloads modules in dev and renders on both server and client.
// Re-calling initializeApp would throw "app already exists", so we reuse the
// existing instance if one is present.
const app: FirebaseApp | undefined = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : undefined

// Once configured, these are real instances. Before that they are undefined at
// runtime — the casts keep call-site types clean, and the guards above ensure
// we never actually touch them until Firebase is ready.
export const auth = (app ? getAuth(app) : undefined) as Auth
export const db = (app ? getFirestore(app) : undefined) as Firestore
export const storage = (app ? getStorage(app) : undefined) as FirebaseStorage

// Pre-built provider for the "Sign in with Google" button.
export const googleProvider = new GoogleAuthProvider()
