"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = (await res.json()) as { success: boolean; error?: string }

      if (!res.ok || !data.success) {
        if (data.error === "UNAUTHORIZED_OPERATOR") {
          setError("Your account is authenticated with Supabase, but is not an approved operator for this application.")
        } else {
          setError("Invalid email or password.")
        }
        setLoading(false)
        return
      }

      router.push("/")
      router.refresh()
    } catch {
      setError("An unexpected error occurred during sign in.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-8">
        <h1 className="text-2xl font-bold mb-2 text-white">Brik Engine Sign In</h1>
        <p className="text-sm text-slate-400 mb-6">Internal operator authentication</p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-500/50 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Operator Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-500"
              placeholder="operator@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}

