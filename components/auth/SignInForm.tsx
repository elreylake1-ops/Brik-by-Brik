"use client"

import { useState } from "react"

export default function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (response.ok) {
        window.location.assign(next)
        return
      }
      const body = await response.json().catch(() => ({}))
      setError(
        body?.error === "TOO_MANY_ATTEMPTS"
          ? "Too many attempts. Try again later."
          : body?.error === "SIGN_IN_UNAVAILABLE"
            ? "Sign-in is not available in this environment."
            : "Sign-in failed. Check your details, or ask for operator access."
      )
    } catch {
      setError("Sign-in failed. Try again.")
    } finally {
      setPassword("")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm">
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Password
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  )
}
