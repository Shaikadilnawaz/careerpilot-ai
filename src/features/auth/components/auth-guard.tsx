"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "@/features/auth/auth-context"

/**
 * Wraps protected pages. While Firebase is still checking the session we show a
 * spinner; if there's no user we redirect to /login; only a signed-in user
 * sees the children.
 *
 * NOTE: this is a UX guard (don't flash protected UI). Real security lives in
 * Firestore/Storage rules, which lock each user's data to their own uid.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [loading, user, router])

  // Loading, or logged-out and about to redirect: show a spinner, never the page.
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
