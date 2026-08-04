/**
 * Auth service — the ONLY module that calls Firebase Auth directly.
 *
 * Components and the AuthProvider import these functions instead of touching
 * `firebase/auth` themselves. That keeps Firebase as a swappable detail and
 * gives us one place to handle errors consistently.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth"

import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase/client"

/**
 * Guard used by every auth action. If keys aren't in place yet, we throw an
 * error carrying a code that getAuthErrorMessage turns into clear guidance,
 * rather than letting Firebase throw something cryptic.
 */
function assertConfigured() {
  if (!isFirebaseConfigured) {
    const error = new Error("Firebase is not configured") as Error & {
      code: string
    }
    error.code = "app/not-configured"
    throw error
  }
}

/** Create a new account with email + password, then set the display name. */
export async function signUpWithEmail(
  displayName: string,
  email: string,
  password: string
): Promise<UserCredential> {
  assertConfigured()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  // Firebase creates the user without a name, so we set it in a second step.
  await updateProfile(credential.user, { displayName })
  return credential
}

/** Sign in an existing user with email + password. */
export function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  assertConfigured()
  return signInWithEmailAndPassword(auth, email, password)
}

/** Open the Google popup and sign in / sign up with the chosen account. */
export function signInWithGoogle(): Promise<UserCredential> {
  assertConfigured()
  return signInWithPopup(auth, googleProvider)
}

/** Sign the current user out. */
export function signOutUser(): Promise<void> {
  return signOut(auth)
}

/**
 * Firebase reports failures as codes (e.g. "auth/email-already-in-use").
 * This turns them into messages we can safely show a user. We deliberately keep
 * sign-in errors vague ("Incorrect email or password") so we don't reveal
 * whether an email is registered — a small but real security practice.
 */
export function getAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : ""

  switch (code) {
    case "app/not-configured":
      return "Authentication isn't set up yet. Add your Firebase keys to .env.local."
    case "auth/email-already-in-use":
      return "An account with this email already exists."
    case "auth/invalid-email":
      return "That email address is not valid."
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters."
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password."
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again."
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled."
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again."
    default:
      return "Something went wrong. Please try again."
  }
}
