import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea — styled to match Input.
 *
 * Base UI ships an `Input` primitive but no textarea, so this is a plain
 * <textarea> wearing the same classes. Nothing here needs the extra behaviour a
 * primitive would provide (no popover, no composition, no ARIA wiring beyond
 * what the native element already gives you).
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
