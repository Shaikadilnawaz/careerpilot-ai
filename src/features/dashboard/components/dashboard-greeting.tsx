"use client"

import { useAuth } from "@/features/auth/auth-context"

/**
 * Small client component that greets the signed-in user by name. Kept separate
 * so the rest of the dashboard page can stay a Server Component — only this
 * tiny piece needs the client-side auth state.
 */
export function DashboardGreeting() {
  const { user } = useAuth()
  // Show only the first name if we have a full display name.
  const firstName = user?.displayName?.split(" ")[0] ?? "there"

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back, {firstName} 👋
      </h1>
      <p className="text-muted-foreground text-sm">
        Here&apos;s an overview of your job search.
      </p>
    </div>
  )
}
