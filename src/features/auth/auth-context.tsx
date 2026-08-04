"use client"

/**
 * AuthProvider — makes "the current user" available to the whole app.
 *
 * It subscribes to Firebase's onAuthStateChanged listener once, keeps the user
 * in React state, and exposes it (plus the auth actions) through a Context so
 * any component can call `useAuth()` instead of re-wiring Firebase everywhere.
 */
import * as React from "react"
import { onAuthStateChanged, type User } from "firebase/auth"

import { auth, isFirebaseConfigured } from "@/lib/firebase/client"
import {
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from "@/features/auth/services/auth-service"

type AuthContextValue = {
  /** The signed-in Firebase user, or null if signed out. */
  user: User | null
  /** True until Firebase has finished its first session check. */
  loading: boolean
  signUp: typeof signUpWithEmail
  signIn: typeof signInWithEmail
  signInGoogle: typeof signInWithGoogle
  signOut: typeof signOutUser
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  // Start as "loading" only if there's actually a Firebase session to check.
  // 📌 `isFirebaseConfigured` is a module constant, so we can compute the right
  // initial value up front instead of rendering `true` and immediately
  // correcting it inside an effect — which would cost an extra render pass and
  // is what React 19's set-state-in-effect rule warns about.
  const [loading, setLoading] = React.useState(isFirebaseConfigured)

  React.useEffect(() => {
    // Before Firebase keys are added, there's no session to check — just render
    // the app as "signed out" instead of hanging on a loading spinner forever.
    // Nothing to subscribe to until the keys exist; `loading` already starts
    // false in that case, so the app renders as signed-out immediately.
    if (!isFirebaseConfigured) return

    // Subscribe once on mount. Firebase fires this immediately with the restored
    // session (or null), and again on every future login/logout.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    // Clean up the listener when the provider unmounts to avoid memory leaks.
    return () => unsubscribe()
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signUp: signUpWithEmail,
    signIn: signInWithEmail,
    signInGoogle: signInWithGoogle,
    signOut: signOutUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth() — the hook every component uses to read auth state or act on it.
 * Throwing when used outside the provider catches wiring mistakes early.
 */
export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an <AuthProvider>")
  }
  return context
}
