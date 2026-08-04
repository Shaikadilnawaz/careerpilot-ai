/**
 * requireUser — the auth boundary for every Server Action.
 *
 * THE PROBLEM THIS SOLVES
 * Firebase's client SDK keeps the signed-in user's ID token in IndexedDB, not in
 * a cookie. Cookies ride along with every request automatically; IndexedDB does
 * not. So when a Server Action runs, it has no idea who called it — there is no
 * `auth.currentUser` on the server, because that object only exists in a browser.
 *
 * THE FIX
 * The client sends its ID token as an explicit argument. An ID token is a signed
 * JWT issued by Google. `verifyIdToken` checks the cryptographic signature
 * against Google's public keys, so a forged or edited token is rejected — the
 * caller cannot simply claim to be someone else by sending a different uid.
 *
 * WHY THIS FILE EXISTS AS A SEAM
 * Every Server Action funnels through this ONE function. If we later move to
 * Firebase session cookies (httpOnly, readable via `cookies()`), only this file
 * changes — no action, service, or component is touched. Same idea as
 * `src/lib/ai/client.ts` naming the LLM provider exactly once.
 */
import "server-only"
import { adminAuth } from "@/lib/firebase/admin"

/**
 * A distinct error type so callers can tell "you're not logged in" apart from
 * "the AI call failed" and show the right message. Never leak the underlying
 * Firebase error text to the client — it can hint at internals.
 */
export class AuthError extends Error {
  constructor(message = "You need to be signed in to do that.") {
    super(message)
    this.name = "AuthError"
  }
}

/**
 * Verifies the caller's ID token and returns their uid.
 *
 * The parameter is typed `unknown` on purpose: this value arrives over the wire
 * from a public HTTP endpoint, so TypeScript's promise that it's a string is
 * worth nothing here. We check it at runtime.
 *
 * @throws {AuthError} when the token is missing, malformed, expired, or revoked.
 */
export async function requireUser(idToken: unknown): Promise<string> {
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new AuthError()
  }

  try {
    // Second arg = checkRevoked. Without it, a token stays valid for up to an
    // hour even after the user signs out everywhere or you disable the account.
    // With it, Firebase is asked whether the session is still good. That costs
    // one extra network round-trip (~50-100ms) — irrelevant next to a 3-10s AI
    // call, and it means "sign out all devices" actually works.
    const decoded = await adminAuth.verifyIdToken(idToken, true)
    return decoded.uid
  } catch {
    // Expired, revoked, malformed, wrong project — all the same to the user:
    // sign in again. We deliberately collapse them into one vague message.
    throw new AuthError("Your session has expired. Please sign in again.")
  }
}
