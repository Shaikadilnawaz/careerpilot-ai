import { redirect } from "next/navigation"

// The landing entry point. For now we send everyone to the login page; once
// server-side session checks are in place (next chunk) this will route
// logged-in users straight to their dashboard.
export default function Home() {
  redirect("/login")
}
