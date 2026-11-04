import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export type CookieToSet = {
  name: string
  value: string
  options?: {
    path?: string
    domain?: string
    maxAge?: number
    expires?: Date
    sameSite?: boolean | "lax" | "strict" | "none"
    httpOnly?: boolean
    secure?: boolean
    [key: string]: unknown
  }
}

export type SupabaseEnvConfig = {
  supabaseUrl: string
  supabaseAnonKey: string
}

export function getSupabaseEnv(env: Record<string, string | undefined> = process.env): SupabaseEnvConfig | null {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return { supabaseUrl, supabaseAnonKey }
}

/**
 * Creates a Supabase client for Server Components and Server Actions.
 */
export async function createServerSupabaseClient(env: Record<string, string | undefined> = process.env) {
  const conf = getSupabaseEnv(env)
  if (!conf) return null

  const cookieStore = await cookies()

  return createServerClient(conf.supabaseUrl, conf.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as any)
          })
        } catch {
          // In Server Components, setAll can throw; caught safely.
        }
      },
    },
  })
}

/**
 * Creates a Supabase client for Route Handlers, capable of reading and setting response cookies.
 */
export function createRouteHandlerSupabaseClient(request: Request, env: Record<string, string | undefined> = process.env) {
  const conf = getSupabaseEnv(env)
  if (!conf) return null

  // Capture cookie mutations so they can be attached to the route's response
  const cookiesToSetList: CookieToSet[] = []

  // Extract cookies from request headers
  const cookieHeader = request.headers.get("cookie") || ""
  const parsedCookies = parseCookieHeader(cookieHeader)

  const supabase = createServerClient(conf.supabaseUrl, conf.supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.entries(parsedCookies).map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach((newCookie) => {
          const idx = cookiesToSetList.findIndex((c) => c.name === newCookie.name)
          if (idx >= 0) {
            cookiesToSetList[idx] = newCookie
          } else {
            cookiesToSetList.push(newCookie)
          }
        })
      },
    },
  })

  return {
    supabase,
    applyCookies<T extends Response>(response: T): T {
      cookiesToSetList.forEach(({ name, value, options }) => {
        // Construct standard Set-Cookie string or append
        let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
        if (options?.maxAge !== undefined) {
          cookieStr += `; Max-Age=${options.maxAge}`
        } else if (options?.expires) {
          cookieStr += `; Expires=${options.expires.toUTCString()}`
        }
        if (options?.path) cookieStr += `; Path=${options.path}`
        else cookieStr += "; Path=/"
        if (options?.httpOnly) cookieStr += "; HttpOnly"
        if (options?.secure || process.env.NODE_ENV === "production") cookieStr += "; Secure"
        if (options?.sameSite) cookieStr += `; SameSite=${options.sameSite}`
        else cookieStr += "; SameSite=Lax"

        response.headers.append("set-cookie", cookieStr)
      })
      return response
    },
  }
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {}
  if (!cookieHeader) return list

  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=")
    name = name?.trim()
    if (!name) return
    const value = rest.join("=").trim()
    try {
      list[name] = decodeURIComponent(value)
    } catch {
      list[name] = value
    }
  })

  return list
}

