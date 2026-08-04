/**
 * ROUTE HANDLER — issues scoped, short-lived upload tokens.
 *
 * WHY A ROUTE HANDLER AND NOT A SERVER ACTION
 * Two reasons, and both are worth being able to explain:
 *
 * 1. Server Action request bodies are capped at 1 MB. Resumes are allowed up to
 *    5 MB, so routing the file THROUGH our server would fail for most real
 *    resumes. Instead the browser uploads straight to Vercel Blob and our
 *    server only authorizes it — the bytes never touch us.
 *
 * 2. Server Actions are for OUR code calling OUR function with typed arguments.
 *    Route Handlers are for when something else defines the protocol. Here the
 *    `@vercel/blob/client` SDK posts its own request shape and expects its own
 *    response shape; `handleUpload` implements that contract. Same reason
 *    webhooks and OAuth callbacks are Route Handlers.
 *
 * THE SECURITY MODEL
 * This is a public POST endpoint (everything under /api is). Anyone can call
 * it. So it authenticates the caller itself, exactly like a Server Action must.
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

import { blobToken } from "@/lib/blob/client"
import { requireUser } from "@/lib/auth/require-user"
import { ACCEPTED_RESUME_TYPE, MAX_RESUME_BYTES } from "@/features/resumes/schema"

// firebase-admin needs Node APIs — it cannot run on the Edge runtime.
export const runtime = "nodejs"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: blobToken,

      /**
       * Called BEFORE any token is minted. This is the security gate: whatever
       * we return here is baked into a token the browser then uses to upload.
       */
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // The browser sends its Firebase ID token in clientPayload. Same
        // pattern as our Server Actions: identity is proven by a signed JWT
        // that we verify server-side, never by anything the client asserts.
        let idToken: unknown
        try {
          idToken = JSON.parse(clientPayload ?? "{}").idToken
        } catch {
          throw new Error("Malformed upload request.")
        }

        // Throws if missing, forged, expired, or revoked.
        const uid = await requireUser(idToken)

        // ⚠️ THE CRITICAL CHECK. The client chooses its own pathname, so
        // without this someone could request a token for another user's folder
        // and overwrite their resume. We pin the path to the VERIFIED uid.
        const requiredPrefix = `users/${uid}/resumes/`
        if (!pathname.startsWith(requiredPrefix)) {
          throw new Error("Invalid upload path.")
        }

        return {
          // Enforced by Vercel at upload time, not just by our UI. Client-side
          // Zod validation is UX; THIS is the boundary. A tampered client
          // cannot push a 4 GB file or a .exe renamed to .pdf.
          allowedContentTypes: [ACCEPTED_RESUME_TYPE],
          maximumSizeInBytes: MAX_RESUME_BYTES,
          // We already generated a unique id for the pathname, so a random
          // suffix would only make the path unpredictable for no benefit.
          addRandomSuffix: false,
          // Short window: the token is only meant to cover this one upload.
          validUntil: Date.now() + 60 * 1000,
        }
      },

      /**
       * Called by Vercel's servers AFTER the upload finishes.
       *
       * 📌 This does NOT fire in local development — Vercel cannot reach
       * http://localhost. So we deliberately do not write Firestore here; the
       * client does that once `upload()` resolves. Putting essential logic in a
       * callback that never runs locally is a classic way to ship something
       * that works on your machine and nowhere else, or vice versa.
       */
      onUploadCompleted: async () => {
        // Intentionally empty. Metadata is written by the client after upload.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Blob upload authorization failed:", error)
    // 400, not 500: the overwhelming majority of failures here are a bad or
    // expired token, or a path that isn't the caller's. Never echo the real
    // error message back — it can describe our internals to an attacker.
    return NextResponse.json(
      { error: "Upload was not authorized." },
      { status: 400 }
    )
  }
}
