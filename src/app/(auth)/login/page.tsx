import type { Metadata } from "next"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = {
  title: "Sign in · CareerPilot AI",
}

export default function LoginPage() {
  return <LoginForm />
}
