"use server"

/**
 * SERVER ACTION — runs on the server, callable from the browser.
 *
 * The `"use server"` directive at the top marks EVERY export in this file as a
 * Server Function. When a Client Component imports and calls `extractResumeText`,
 * Next.js turns that call into a POST request to the server, runs this code
 * there, and returns the result. The browser never sees this code or its
 * dependencies (unpdf, Node APIs) — that's the whole point.
 *
 * Why extraction MUST be server-side:
 *  - PDF parsing needs Node-land libraries; shipping them to the browser would
 *    bloat the bundle and some rely on server-only APIs.
 *  - Keeping heavy/CPU work off the user's device.
 *
 * ⚠️ Week 3 hardening: Server Functions are reachable by direct POST, so we will
 * verify the caller's Firebase ID token here (Admin SDK) once it's set up. For
 * now this only does CPU work (text extraction) and returns text to the caller —
 * it never reads or writes the database.
 */
import { extractText, getDocumentProxy } from "unpdf"

export type ExtractResult =
  | { ok: true; text: string; pages: number }
  | { ok: false; error: string }

/**
 * Takes the uploaded PDF (sent as FormData) and returns its plain text.
 * We accept FormData because that's how the browser cheaply ships a binary File
 * to a Server Action without us hand-rolling serialization.
 */
export async function extractResumeText(formData: FormData): Promise<ExtractResult> {
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return { ok: false, error: "No file was received." }
  }

  try {
    // File → ArrayBuffer → Uint8Array is what the PDF parser expects.
    const buffer = await file.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(buffer))

    // mergePages: true joins every page into one string (what the AI wants later).
    const { text, totalPages } = await extractText(pdf, { mergePages: true })

    return { ok: true, text: text.trim(), pages: totalPages }
  } catch (error) {
    console.error("PDF text extraction failed:", error)
    return { ok: false, error: "Could not read text from this PDF." }
  }
}
