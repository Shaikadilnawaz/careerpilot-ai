import { z } from "zod"

/**
 * Zod schemas = the single source of truth for what valid auth input looks like.
 *
 * We validate on the client (instant feedback in the form) AND could reuse the
 * exact same schema on the server. Define the rules once, never duplicate them.
 */

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const signupSchema = z
  .object({
    displayName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  // .refine adds a cross-field rule: the two password fields must match.
  // `path` tells the form which field to attach the error message to.
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

// z.infer generates the TypeScript type FROM the schema — so the type and the
// validation can never drift out of sync. One definition, two guarantees.
export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
