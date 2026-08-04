import Link from "next/link"
import { Plane, Sparkles, FileText, LineChart } from "lucide-react"

/**
 * Layout shared by every page in the (auth) route group (login, signup).
 * Left: a branded gradient panel (desktop only). Right: the form, on a
 * frosted-glass card. The parentheses keep "(auth)" out of the URL.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel — hidden on small screens to keep mobile clean. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Soft glowing orbs for depth */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-fuchsia-300/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2 text-lg font-semibold">
          <Plane className="size-6" />
          CareerPilot AI
        </Link>

        <div className="relative flex flex-col gap-6">
          <h2 className="text-3xl font-semibold leading-tight">
            Your AI copilot for landing the job.
          </h2>
          <ul className="flex flex-col gap-4 text-white/90">
            <li className="flex items-center gap-3">
              <Sparkles className="size-5 shrink-0" />
              Instant ATS score & resume feedback
            </li>
            <li className="flex items-center gap-3">
              <FileText className="size-5 shrink-0" />
              Keep every resume version in one place
            </li>
            <li className="flex items-center gap-3">
              <LineChart className="size-5 shrink-0" />
              Track applications from wishlist to offer
            </li>
          </ul>
        </div>

        <p className="relative text-sm text-white/70">
          © {new Date().getFullYear()} CareerPilot AI
        </p>
      </div>

      {/* Right: the form area. */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
