import { NextResponse } from "next/server"
import { signInRequest, signOutRequest, type AuthResponse } from "@/lib/auth/sign-in"
import { resolveOperatorIdentity } from "@/lib/auth/operator-auth"

export const dynamic = "force-dynamic"

function respond({ status, body, setCookie }: AuthResponse) {
  const response = NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })
  if (setCookie) response.headers.append("set-cookie", setCookie)
  return response
}

// Whether the caller is a signed-in operator. Reveals nothing about who.
export async function GET(request: Request) {
  const identity = await resolveOperatorIdentity(request)
  return NextResponse.json({ authenticated: identity.status === "authenticated" }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: Request) {
  return respond(await signInRequest(request))
}

export async function DELETE(request: Request) {
  return respond(await signOutRequest(request))
}
