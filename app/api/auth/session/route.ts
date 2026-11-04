import { NextResponse } from "next/server"
import { createRouteHandlerSupabaseClient } from "@/lib/auth/supabase-server"
import { createAllowlistMembershipStore } from "@/lib/auth/operator-auth"
import { isSameOrigin } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  // CSRF verification on sign-in mutation if Origin header is present
  if (request.headers.get("origin") && !isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "CROSS_ORIGIN_REJECTED" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const routeClient = createRouteHandlerSupabaseClient(request)
  if (!routeClient) {
    return NextResponse.json(
      { success: false, error: "AUTH_CONFIG_UNAVAILABLE" },
      { status: 503, headers: { "cache-control": "no-store" } }
    )
  }

  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "INVALID_CREDENTIALS" },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const { data, error } = await routeClient.supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error || !data.user?.id) {
      return NextResponse.json(
        { success: false, error: "INVALID_CREDENTIALS" },
        { status: 401, headers: { "cache-control": "no-store" } }
      )
    }

    const membership = createAllowlistMembershipStore(process.env.OPERATOR_ALLOWED_SUBJECTS)
    const isAllowed = membership ? await membership.isActiveOperator(data.user.id) : false

    if (!isAllowed) {
      // Sign out immediately if not in operator allowlist
      await routeClient.supabase.auth.signOut()
      const resp = NextResponse.json(
        { success: false, error: "UNAUTHORIZED_OPERATOR" },
        { status: 403, headers: { "cache-control": "no-store" } }
      )
      return routeClient.applyCookies(resp)
    }

    const resp = NextResponse.json(
      { success: true, user: { id: data.user.id, email: data.user.email } },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
    return routeClient.applyCookies(resp)
  } catch {
    return NextResponse.json(
      { success: false, error: "SIGN_IN_FAILED" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function DELETE(request: Request) {
  if (request.headers.get("origin") && !isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "CROSS_ORIGIN_REJECTED" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const routeClient = createRouteHandlerSupabaseClient(request)
  if (!routeClient) {
    return NextResponse.json({ success: true }, { status: 200, headers: { "cache-control": "no-store" } })
  }

  try {
    await routeClient.supabase.auth.signOut()
    const resp = NextResponse.json(
      { success: true },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
    return routeClient.applyCookies(resp)
  } catch {
    return NextResponse.json(
      { success: true },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
  }
}

