# Week 4 Study Sheet — Tracker, Tailored Resume, Cover Letter, PDF, Deploy

Everything I should be able to explain in an interview after Week 4.

Week 3 was "can the app talk to an LLM at all". Week 4 is the harder question:
**now that it can, where does each piece of work belong, and what happens when
the answer is different for every feature?** Three AI features got built this
week and no two of them use the same architecture — that contrast is the whole
value of the week.

---

## 0. What we actually did in Week 4 (the build log)

**Code written:**

1. `src/features/applications/schema.ts` — the tracker's contracts: the status
   pipeline as a `const` array, the Zod input schema, the Firestore doc type.
2. `src/features/applications/services/application-service.ts` — **client-SDK**
   CRUD + a live `onSnapshot` subscription.
3. `src/features/applications/components/` — `application-form`,
   `application-list`, `application-card`.
4. `src/features/tailor/schema.ts` — the tailored-resume contract, plus
   `ProfileLinks`, `normalizeUrl`, `displayUrl`.
5. `src/features/tailor/prompts.ts` — a system prompt whose main job is
   **refusing to lie**.
6. `src/features/tailor/services/tailor-service.ts` — `generateObject`,
   temperature 0.4, `maxOutputTokens` 8192. **Deliberately persists nothing.**
7. `src/features/tailor/actions/tailor-resume.ts` — the Server Action.
8. `src/features/tailor/actions/recheck-draft.ts` — re-score the *unsaved*
   draft. The one action that takes content instead of a reference.
9. `src/features/tailor/to-text.ts` — flatten the structured draft back to text
   so the Week 3 analyser can score it.
10. `src/features/tailor/components/resume-pdf.tsx` — the PDF template.
11. `src/features/tailor/components/tailored-resume-editor.tsx` — a fully
    **controlled** editor; owns nothing but PDF generation.
12. `src/features/cover-letter/` — schema, prompts, service (`generateText`,
    temperature 0.7), action, editor, PDF.
13. `src/features/analysis/components/analyze-form.tsx` — rebuilt as the single
    surface for all four AI tasks.
14. `src/app/(dashboard)/analyze/page.tsx` — `export const maxDuration = 60`.

**Operations / firefighting:**

15. Deployed to Vercel; added the production domain to Firebase **Authorized
    domains** (auth popups fail on any origin not on that list).
16. **Diagnosed a full production 500 outage** — four wrong hypotheses before
    the real cause. See §9. This is the best story in the whole project.
17. Fixed the resume preview always claiming pop-ups were blocked (§10).
18. **Rebuilt the resume on the Jake's template** after testing against a real
    resume exposed a silent data-loss bug in the schema (§6).

---

## 1. The Week 4 thesis — *where does this work belong?* ⭐⭐

Four features, four different answers. If you can only remember one thing from
this week, remember this table and why each row differs.

| Feature | Where it runs | Why |
| --- | --- | --- |
| Application tracker | **Client SDK**, browser → Firestore | No secret, no cost, user's own data, rules already cover it. Real-time sync for free. |
| Analyze / Tailor / Cover letter | **Server Action** | Secret API key, costs money per call, output must not be forgeable. |
| Resume upload | **Route Handler** | The blob SDK owns the request/response protocol, and bodies exceed the 1 MB Server Action cap. |
| PDF generation | **Browser only** | Pure function of data already in the browser. Sending it to a server would add a round-trip and buy nothing. |

📌 **The reasoning is the answer, not the list.** "I put it on the server"
is worthless in an interview; "there's a secret and a per-call cost, so the
client can never be trusted with it" is the answer they're listening for.

---

## 2. Why the tracker is deliberately NOT a Server Action ⭐

Week 3 ended with "everything sensitive goes through `requireUser`". The
temptation is to apply that everywhere. Applying it here would be wrong.

Ask the four questions:

1. **Is there a secret?** No.
2. **Does it cost money per call?** No.
3. **Could a forged write harm anyone?** No — it's the user's own notes.
4. **Do the Firestore rules already cover it?** Yes: owner-only on
   `users/{uid}/applications/{id}`.

All four say "client". So the client SDK is correct, and it hands you real-time
sync (`onSnapshot`) for free — something a Server Action cannot do at all.

📌 **Security posture is per-resource, not per-app.** A blanket "everything on
the server" is not a stronger design; it's an unexamined one, and it costs you
real features.

---

## 3. Data modelling — the tracker is the hub ⭐

Resumes and analyses float free until an **application** binds them to a real
job. That's why the application document carries a `resumeId`.

**Two modelling decisions worth defending:**

- **`as const` on the status array.** `APPLICATION_STATUSES` is one array that
  produces three things: the render order, the Zod enum, and the TypeScript
  union `"saved" | "applied" | …`. Without `as const`, TS infers `string[]` and
  you get none of it.
- **Denormalised `resumeName`.** Storing a copy of the filename on the
  application means rendering 20 applications costs 20 reads, not 40. The
  standard NoSQL trade: duplicate a little data to avoid a fan-out read.

📌 **The Zod trap worth memorising:** an empty text input submits `""`, **not**
`undefined`. So `.url().optional()` fails on an untouched optional URL field.
The fix is `z.union([z.string().url(), z.literal("")]).optional()`. This is the
single most common Zod mistake in forms.

---

## 4. Structured output vs. prose — `generateObject` vs `generateText` ⭐⭐

| | Tailored resume | Cover letter |
| --- | --- | --- |
| Call | `generateObject` | `generateText` |
| Returns | `object`, schema-validated | `text`, a raw string |
| Failure mode | throws `NoObjectGeneratedError` | returns a *shorter string* |
| Who validates | Zod, automatically | **you, by hand** |

📌 **Losing the schema means inheriting the validation job.** That's why
`write-cover-letter.ts` has `MIN_LETTER_CHARS = 200` — with no schema, garbage
doesn't throw, it just comes back small. A structured call gets that check for
free; a text call does not.

**Why the resume is data and not prose:** because the AI returning *data* is
what makes everything downstream possible — one template renders it identically
every time, the user can edit one bullet without disturbing the rest, and the
output is ATS-safe by construction instead of by luck. If the model returned
formatted text you would be parsing it back apart to do any of that.

---

## 5. Temperature is a per-feature decision ⭐

Three features, three values, and the reason differs each time:

- **0.2 — analysis.** It produces a *score*. The same resume scoring 61 then 78
  destroys the user's trust in the number.
- **0.4 — tailoring.** Enough freedom to rephrase a bullet well, tight enough
  that it stays anchored to the facts it was given.
- **0.7 — cover letter.** Variety is the entire point. Two applications must
  not receive the same letter with the company name swapped.

📌 Being able to explain *why each number differs* is worth far more than
knowing what the parameter does.

---

## 6. The schema bug that would have shipped ⭐⭐ (the best lesson of the week)

Testing with a **real** resume — not a made-up one — revealed that the tailored
output was missing both Oracle certifications, the achievements, the CGPA, and
the location.

The prompt clearly said *"Keep every certification and achievement."* The prompt
was irrelevant.

📌 **The model can only emit fields the schema defines.** There was no
`certifications` field, no `achievements`, no `location`, no education `detail`.
So the data had nowhere to go, and it vanished silently — no error, no warning,
just a resume with two certifications quietly deleted from a real person's job
application.

**A missing schema field is data loss, not a cosmetic gap.**

Two follow-on lessons:

- **Test with real data.** Every synthetic fixture I used happened to have no
  certifications, so every test passed. The bug was invisible until a real PDF
  went through.
- **A prompt cannot compensate for a schema.** The schema is the hard boundary;
  the prompt only shapes what happens *inside* it. When they disagree, the
  schema wins every time.

---

## 7. Prompt design when the model rewrites rather than judges ⭐

Week 3's analyser was a critic. A critic that exaggerates is annoying. **A
writer that invents experience puts the candidate in a room defending work they
never did.** So the tailor prompt is mostly a list of refusals:

- Never invent an employer, role, date, degree, project or technology.
- Never invent numbers — turning "fixed many bugs" into "resolved 20+ bugs" is
  fabrication.
- Never inflate seniority.
- Never delete anything from the original — reorder and rewrite only.
- Preserve dates, grades and scores **exactly**.
- **If there's no work experience, return an empty array. Do not promote
  projects into jobs.**

**How the job description is allowed to matter:**

> Let the job description drive the **ORDER** and the **LABELS**, never the
> facts. Reordering and relabelling are tailoring; **adding is fabrication.**

So a posting that stresses REST APIs can rename a category to "Backend & APIs"
and float the matching project to the top — but it cannot add a skill.

📌 **The honest failure case is a designed feature:** *"If the candidate is
genuinely underqualified, still produce the strongest HONEST version. It is not
your job to close the gap with fiction."* An AI product that will lie for the
user is a liability, not a feature.

Injection defences carry over from Week 3 unchanged: instructions live in
`system`, untrusted text is tag-fenced with literal closing tags stripped, and
the schema bounds the blast radius.

---

## 8. PDF generation — React's model, a different renderer ⭐

`@react-pdf/renderer` looks like React and is not the web:

- No Tailwind, no CSS files, **no cascade**. `StyleSheet.create`, attached per
  element.
- Flexbox **subset** only. No grid, no float.
- `<View>` / `<Text>` instead of `<div>` / `<span>`. **Every string must sit
  inside a `<Text>`** or it throws.
- **Built-in fonts only** unless you register one — Helvetica, Times, Courier.
  Times-Roman was chosen because it's the closest built-in match to LaTeX's
  serif look and needs no network fetch at render time.
- `<Link src="…">GitHub</Link>` is the `<a href>` equivalent: the visible text
  is the *word*, the URL is attached as a clickable annotation.
- `wrap={false}` on an entry stops it splitting across a page break.

**Two decisions worth explaining:**

- **Lazy-imported inside the click handler**, not at module top. It's heavy and
  browser-only, so people who never download never pay for the bytes.
- **ATS-optimised by construction** — one column, real selectable text, standard
  headings, no tables, no graphics, no icons. Exactly the things the Week 3
  analyser scores. The app's own two features agree with each other.

📌 **Profile links deliberately bypass the AI.** They go user input → editor →
PDF, untouched. Routing them through `generateObject` would let the model
reformat, truncate or invent a URL, and **a broken link on a resume is worse
than no link at all.** Know which data should never touch the model.

---

## 9. THE PRODUCTION OUTAGE ⭐⭐⭐ (tell this story in interviews)

Every server route in production returned 500. Locally: perfect.

**Four hypotheses, all wrong, each killed by evidence:**

| # | Guess | Killed by |
| --- | --- | --- |
| 1 | Private key wrapped in quotes | `hadWrappingQuotes: false` |
| 2 | Key revoked or stale | error was `ERR_REQUIRE_ESM`, not auth |
| 3 | Key malformed | `hasPemHeader: true`, length 1732 |
| 4 | Old Node without `require(ESM)` | prod reported Node v24.18.0, `supportsRequireEsm: true` |

**Actual cause:** `firebase-admin` sits on Next.js's **default
`serverExternalPackages` list**. That means it is *not bundled* — it's
`require()`d from `node_modules` at runtime. Its dependency tree contains ESM,
so `require()` threw `ERR_REQUIRE_ESM` **at module load**, before a single line
of route code ran. No `try/catch` anywhere in my code could reach it.

**Fix:** one line — `transpilePackages: ["firebase-admin"]` in `next.config.ts`.

**How it was actually found:** by shipping a temporary `/api/health` endpoint
that returned **presence booleans and key *shape*, never values**, plus the
runtime version and a redacted error. Then deleting it.

📌 **My own mistake made it take four rounds.** The redaction regex was
`[A-Za-z0-9+/=_.-]{24,}` — which blanked **file paths and package names** right
along with secrets, destroying the exact evidence that would have identified the
package. **Redact by what a value IS, not by what it superficially matches.**

📌 Second lesson: **"works locally" and "works in production" are different
claims.** `npm run dev` and `npm run build && npm start` are different code
paths. Reproducing production locally is what finally exposed it.

---

## 10. Bugs worth remembering

**`window.open()` returns `null` when `noopener` is specified.** That's the HTML
spec, not a browser quirk. The preview code read:

```ts
const tab = window.open("", "_blank", "noopener,noreferrer")
if (!tab) toast.error("Please allow pop-ups")   // ← always fired
```

It reported blocked pop-ups to users whose pop-ups were fine. Fix:

```ts
const tab = window.open("", "_blank")
if (tab) tab.opener = null
```

**`request.json()` must live inside the `try`.** An empty body threw before the
handler could respond, turning a 400 into a 500. Also: a missing env var is a
**503** (our fault), a bad payload is a **400** (theirs).

**Firebase Authorized domains.** Auth popups fail on any origin not on that
list, so the first production sign-in attempt breaks until the Vercel domain is
added. Nothing in the code is wrong — the config lives elsewhere.

**`maxDuration` is set at the PAGE level**, not on the action. It governs every
Server Action called from that page. AI calls run 10–20s; the platform default
is lower.

---

## 11. React patterns from this week ⭐

**Controlled component.** `TailoredResumeEditor` holds *no draft state*. The
parent owns the draft and passes `onChange`. That's precisely what lets the same
editor sit inside the analyze flow now and an application detail view later,
while the parent decides what else to do with the data — like re-scoring it.
State lives where the *decisions* are made.

**Immutable updates.** Editing one bullet copies the array, replaces one item,
and hands back a new array. Mutating `bullets[i]` in place would not re-render:
React compares by reference, and the reference wouldn't have changed.

**One `useTransition`, four tasks.** `Task = "analyze" | "tailor" | "recheck" |
"letter" | null` drives both the disabled state and the status label. Server
Actions dispatch **sequentially per client**, so parallel buttons would queue,
not race.

---

## 12. Re-scoring the draft — the rule I broke on purpose ⭐⭐

Every other action takes a **reference** (`resumeId`) and re-reads content from
Firestore, so the client can never hand us content and have us treat it as
belonging to a record they may not own.

`recheckDraft` accepts the draft **content** directly. Why that's correct here:

- The draft exists **only in the browser** — the tailor service deliberately
  persists nothing. There is no record, so **there is no ownership question**.
  The user is scoring their own unsaved text.
- But the *other* reason for the rule still applies: unbounded client input
  means unbounded input tokens, which means someone can run up the bill.

So the protections that still matter were kept: the draft must satisfy the full
Zod schema, the flattened text is hard-capped at `MAX_DRAFT_CHARS = 20_000`, and
the caller must still be a verified signed-in user.

📌 **Don't cargo-cult a rule — understand which of its reasons still apply.**
This is the single best answer to give when an interviewer asks about your
security model, because it shows you reason about rules instead of reciting
them.

**Why `to-text.ts` exists:** the analyser reads *text*, because that's what a
real PDF gives it. Flattening the draft in memory removes three lossy steps
(export → re-upload → re-extract) and makes the before/after comparison actually
mean something. It mirrors the PDF's section order so the scored text resembles
the document you'd really send.

---

## 13. Why the tailored resume is never saved ⭐

`tailor-service.ts` returns the draft and writes nothing. Deliberate:

- The user hasn't approved it yet. Persisting an unreviewed AI rewrite of
  someone's work history creates a record they never agreed to.
- **Copilot, not autopilot.** The user reviews, edits, and downloads. The
  artifact becomes real only when *they* act.
- It also sidesteps a versioning problem that buys nothing yet.

---

## 14. 🎤 Interview questions you should be able to answer

1. **Your analyzer is a Server Action but your tracker uses the client SDK —
   why the inconsistency?** → It isn't inconsistent. The analyzer has a secret,
   a per-call cost, and forgeable output. The tracker has none of the three, and
   the rules already cover it — so the client SDK is correct and gives real-time
   sync for free.
2. **When would you use `generateText` over `generateObject`?** → When the
   output genuinely is prose. But you inherit the validation job — garbage no
   longer throws, it just comes back short.
3. **Why does the AI return data instead of formatted resume text?** → A
   template renders it identically every time, the user can edit one field, and
   it's ATS-safe by construction. Text would have to be parsed back apart.
4. **How do you stop an AI resume writer from lying?** → Explicit refusal rules
   in the system prompt, a schema with nowhere to put invented content, the
   job description permitted to change order and labels but never facts, and a
   designed honest-failure path. Verified with a real resume.
5. **Your app has three AI features at three temperatures. Defend each.** →
   0.2 scoring must be stable; 0.4 rewriting needs freedom anchored to facts;
   0.7 letters must not be identical across applications.
6. **Tell me about a bug you caught late.** → The tailor schema had no
   `certifications` field, so tailoring silently deleted a real user's two
   certifications. The prompt said to keep them; the model can only emit fields
   the schema defines. A missing schema field is data loss.
7. **You had a production outage that didn't reproduce locally. Walk me
   through it.** → §9. Four falsified hypotheses, a presence-only health
   endpoint, `firebase-admin` on Next's default `serverExternalPackages` list
   being `require()`d at runtime and hitting `ERR_REQUIRE_ESM` at module load.
   One-line fix. And my redaction regex destroyed the evidence for four rounds.
8. **What's `serverExternalPackages`?** → Packages Next deliberately does *not*
   bundle; they're `require()`d at runtime. Fine for native modules, fatal when
   the dependency tree is ESM.
9. **Why is `recheckDraft` allowed to take content when nothing else is?** →
   The draft was never persisted, so there's no ownership question — but the
   cost question remains, so it keeps Zod validation, a character cap and auth.
10. **How do you generate a PDF in a React app?** → `@react-pdf/renderer` —
    React's model, a different renderer. No cascade, flexbox subset, every
    string inside `<Text>`, built-in fonts. Lazy-imported so non-downloaders
    don't pay for it.
11. **Why don't the profile links go through the model?** → It could reformat,
    truncate or invent a URL, and a broken link is worse than no link. Some data
    should never touch an LLM.
12. **Why is the editor controlled?** → So the parent owns the draft and can
    re-score it. State belongs where the decisions are made.
13. **What's the most common Zod mistake in forms?** → `.url().optional()` on
    an untouched input — an empty field submits `""`, not `undefined`.
14. **What does `as const` buy you on the status array?** → The literal union
    instead of `string[]`, so one array yields render order, Zod enum, and TS
    type.
15. **Why is `maxDuration` on the page and not the action?** → It's a page-level
    export governing every Server Action invoked from that page.
16. **How do you debug something you can only see in production?** → Reproduce
    the production build locally, then ship a temporary diagnostic that returns
    **presence booleans and shapes, never values** — and delete it after.

---

## Files built in Week 4

| File | Role |
| --- | --- |
| `src/features/applications/schema.ts` | Status pipeline (`as const`), Zod input, Firestore doc type |
| `src/features/applications/services/application-service.ts` | Client-SDK CRUD + `onSnapshot` real-time list |
| `src/features/applications/components/*` | Form, list, card |
| `src/features/tailor/schema.ts` | Tailored-resume contract, `ProfileLinks`, `normalizeUrl` |
| `src/features/tailor/prompts.ts` | Never-fabricate rules + JD-drives-order-not-facts |
| `src/features/tailor/services/tailor-service.ts` | `generateObject`, temp 0.4, **persists nothing** |
| `src/features/tailor/actions/tailor-resume.ts` | Server Action: auth → validate → own → AI |
| `src/features/tailor/actions/recheck-draft.ts` | Re-score an unsaved draft; the deliberate exception |
| `src/features/tailor/to-text.ts` | Flatten structured draft → text for re-scoring |
| `src/features/tailor/components/resume-pdf.tsx` | The Jake's-template PDF |
| `src/features/tailor/components/tailored-resume-editor.tsx` | Controlled editor; owns only PDF generation |
| `src/features/cover-letter/services/cover-letter-service.ts` | `generateText`, temp 0.7, 1200 output tokens |
| `src/features/cover-letter/actions/write-cover-letter.ts` | Server Action + hand-rolled sanity check |
| `src/features/cover-letter/components/*` | Editor + PDF |
| `src/features/analysis/components/analyze-form.tsx` | One surface, four AI tasks, one `useTransition` |
| `src/app/(dashboard)/analyze/page.tsx` | `maxDuration = 60` |
| `next.config.ts` | `transpilePackages: ["firebase-admin"]` — the outage fix |
