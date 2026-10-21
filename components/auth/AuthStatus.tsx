"use client"

import { useEffect, useState } from "react"

// Shows sign-in state. Reads only a boolean from the server; the session cookie is HttpOnly and invisible to this code.
export default function AuthStatus() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((b) => live && setAuthenticated(b?.authenticated === true))
      .catch(() => live && setAuthenticated(false))
    return () => {
      live = false
    }
  }, [])

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined)
    window.location.assign("/sign-in")
  }

  if (authenticated === null) return null
  return authenticated ? (
    <button type="button" onClick={signOut} className="text-xs text-gray-600 underline">
      Sign out
    </button>
  ) : (
    <a href="/sign-in?next=/" className="text-xs text-gray-600 underline">
      Sign in
    </a>
  )
}
