"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button type="button" className="btn btn-secondary" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  )
}
