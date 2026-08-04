import { MobileNav } from "@/components/layout/app-sidebar"
import { UserMenu } from "@/components/layout/user-menu"

/**
 * The top bar of the app shell: mobile hamburger on the left (hidden on
 * desktop), user menu on the right. This is a Server Component — it just
 * arranges the two client widgets, so it ships no JS of its own.
 */
export function AppTopbar() {
  return (
    <header className="bg-card/50 flex h-16 shrink-0 items-center gap-4 border-b px-4 backdrop-blur md:px-6">
      <MobileNav />
      <div className="flex-1" />
      <UserMenu />
    </header>
  )
}
