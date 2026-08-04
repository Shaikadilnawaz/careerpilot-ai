# 📘 CareerPilot AI — Week 1 Notes (Authentication & App Shell)

> Study sheet for everything built in Week 1. Re-read the referenced files and
> try to explain each concept out loud — that's what makes it stick for
> interviews.

---

## 1. Project setup & stack

- **Next.js 16 + React 19 + Tailwind v4 + TypeScript**, App Router, `src/` dir.
- **shadcn/ui** uses **Base UI** primitives (not Radix). A Base UI `Trigger`
  renders its own `<button>`; swap the underlying element with the **`render`
  prop** (not Radix's `asChild`).
- **Feature-based folders**: everything for a feature lives in
  `features/<name>/` (components, actions, services, schema) → scales without
  turning into spaghetti.
- **AI provider is named in ONE file** (`src/lib/ai/client.ts`) → swap
  Gemini → OpenAI in a single line.

## 2. Firebase Auth (the core of Week 1)

- Firebase Auth gives you **identity** (who the user is) + an **ID token / JWT**
  (proof the server can cryptographically verify).
- The **browser** learns about login via a **listener**, `onAuthStateChanged`;
  the **server** only knows if you hand it the token.
- `onAuthStateChanged` also **restores the session on refresh** — which is why
  we need a `loading` state before we know whether someone is logged in.
- Firebase reports failures as **codes** (e.g. `auth/email-already-in-use`) →
  we map them to friendly messages in `auth-service.ts`.
- Keep sign-in errors **vague** ("Incorrect email or password") so we don't
  reveal which emails are registered. _(security)_

## 3. Clean Architecture (the rule repeated all project)

- **UI never calls Firebase directly** → it goes through a **service**
  (`auth-service.ts`).
- Layers: **UI → Actions/Context → Services → Domain (types/schema)**.
- Payoff: to change Firebase or the AI provider, only **one layer** changes.

## 4. Forms — the trio reused everywhere

- `react-hook-form` (field state + submit) + `zodResolver` (runs the Zod schema
  as the validator) + shadcn `Form` components (accessible labels/errors).
- `z.infer<typeof schema>` → derive the **TypeScript type FROM the Zod schema**
  (one source of truth, can't drift).
- `.refine()` → cross-field rules (e.g. the two passwords must match).
- `form.formState.isSubmitting` → auto-tracks the async submit, drives the
  button spinner. No manual loading state needed.

## 5. Next.js patterns

- **Route Groups** `(auth)` / `(dashboard)` → parentheses **group routes to
  share a layout WITHOUT changing the URL**. `(auth)/login` → `/login`.
- **Nested layouts**: a group's `layout.tsx` wraps every page inside it (shell
  written once).
- **Server vs Client Components**: pages stay Server Components (small JS
  bundle); only interactive bits (`useAuth`, forms) are `"use client"`.
- A **client Provider** (`AuthProvider`) can wrap the whole app while its
  `children` stay Server Components.

## 6. Route protection & security ⭐ (interview favorite)

- `AuthGuard` = client component: `loading` → spinner, `!user` → redirect to
  `/login`, else render the page.
- **A route guard is UX, NOT security** — it only prevents _flashing_ the
  protected page to a logged-out user.
- **Real security = Firestore/Storage rules** (data locked to its owner's `uid`)
  plus server-side verification of the ID token.

## 7. Production habits we applied

- **Graceful degradation**: don't crash the whole app when an integration isn't
  configured — we used an `isFirebaseConfigured` flag + guards so the UI still
  renders before keys are added.
- `.env.local` is gitignored; `.env.example` is committed as a template.
- `import "server-only"` guard → the build fails if server-only code (like the
  admin key) is ever imported into a browser bundle.
- **Never share secrets** (private keys) in chat, commits, or screenshots. If
  one is exposed, **rotate it**.

## 8. 🎤 Interview questions you should be able to answer

1. Why does the login form call a service instead of importing `firebase/auth`
   directly? → decoupling; one place to change if Firebase changes.
2. Why is your route guard not real security? → it's client-side UX; the real
   security is Firestore rules.
3. Why store the AI provider in one file? → provider-agnostic; swap in one line.
4. Server Component vs Client Component — when do you use each? → default to
   Server for less JS; Client only for interactivity/hooks.
5. Why a `loading` state in the AuthProvider? → session restore is async; avoid
   flashing the wrong UI.
6. How do you validate forms? → Zod schema + `zodResolver`; the same schema can
   be reused on the server.

---

## Files built in Week 1

| File | Role |
| --- | --- |
| `src/lib/firebase/client.ts` | Browser Firebase SDK (auth, firestore, storage) + `isFirebaseConfigured` |
| `src/lib/firebase/admin.ts` | Server-only Firebase Admin SDK |
| `src/lib/ai/client.ts` | Provider-agnostic AI client (Gemini) |
| `src/features/auth/schema.ts` | Zod schemas for login/signup |
| `src/features/auth/services/auth-service.ts` | Only file that calls Firebase Auth |
| `src/features/auth/auth-context.tsx` | `AuthProvider` + `useAuth()` |
| `src/features/auth/components/*` | Login form, signup form, Google button |
| `src/app/(auth)/*` | Split-screen login & signup pages |
| `src/features/auth/components/auth-guard.tsx` | Protects dashboard routes |
| `src/components/layout/*` | Sidebar, mobile nav, topbar, user menu |
| `src/app/(dashboard)/*` | Protected shell + dashboard/resumes/applications pages |
