"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plane, Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { navItems } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex h-16 items-center gap-2 border-b px-6"
    >
      <Plane className="text-primary size-5" />
      <span className="font-semibold">CareerPilot AI</span>
    </Link>
  )
}

/**
 * The nav links. `usePathname` tells us the current route so we can highlight
 * the active item. `onNavigate` lets the mobile drawer close itself on click.
 */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      {navItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/")
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Desktop sidebar — fixed, visible from the `md` breakpoint up. */
export function AppSidebar() {
  return (
    <aside className="bg-card hidden w-64 shrink-0 flex-col border-r md:flex">
      <Brand />
      <NavLinks />
    </aside>
  )
}

/** Mobile drawer — a hamburger that slides the same nav out on small screens. */
export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
        {/* Dialogs need a title for screen readers; hide it visually. */}
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Brand />
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
