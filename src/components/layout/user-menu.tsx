"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LogOut, ChevronsUpDown } from "lucide-react"

import { useAuth } from "@/features/auth/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** Build "AL" from "Ada Lovelace", or fall back to the email's first letter. */
function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }
  return (email?.[0] ?? "U").toUpperCase()
}

export function UserMenu() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  async function handleSignOut() {
    try {
      await signOut()
      toast.success("Signed out")
      router.replace("/login")
    } catch {
      toast.error("Could not sign out. Try again.")
    }
  }

  return (
    <DropdownMenu>
      {/* Base UI's Trigger renders a <button>, so we style it directly rather
          than nesting another button inside it. */}
      <DropdownMenuTrigger className="hover:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-lg p-1 pr-2 outline-none focus-visible:ring-2">
        <Avatar className="size-8">
          <AvatarImage
            src={user?.photoURL ?? undefined}
            alt={user?.displayName ?? "User"}
          />
          <AvatarFallback>
            {getInitials(user?.displayName, user?.email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:block">
          {user?.displayName ?? user?.email ?? "Account"}
        </span>
        <ChevronsUpDown className="text-muted-foreground hidden size-4 sm:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate text-sm font-medium">
              {user?.displayName ?? "User"}
            </span>
            <span className="text-muted-foreground truncate text-xs font-normal">
              {user?.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
