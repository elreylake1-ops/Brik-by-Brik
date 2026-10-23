import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  resolveTrustedInternalOperatorIdentityMock,
} = vi.hoisted(() => ({
  resolveTrustedInternalOperatorIdentityMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/trusted-internal-operator-identity", () => ({
  resolveTrustedInternalOperatorIdentity: resolveTrustedInternalOperatorIdentityMock,
}))

import { requireSavedDealReadAccess } from "@/lib/operator-command/require-saved-deal-read-access"

describe("requireSavedDealReadAccess", () => {
  beforeEach(() => {
    resolveTrustedInternalOperatorIdentityMock.mockReset()
  })

  it("denies unauthenticated requests with 401 and AUTHENTICATION_REQUIRED", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthenticated" })

    await expect(requireSavedDealReadAccess(request, "deal-1")).resolves.toEqual({
      allowed: false,
      reason: "unauthenticated",
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    })
    expect(resolveTrustedInternalOperatorIdentityMock).toHaveBeenCalledTimes(1)
    expect(resolveTrustedInternalOperatorIdentityMock.mock.calls[0][0]).toBe(request)
  })

  it("denies unauthorized identities with privacy-preserving 404", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthorized" })

    await expect(requireSavedDealReadAccess(request, "deal-1")).resolves.toEqual({
      allowed: false,
      reason: "unauthorized",
      status: 404,
      code: "SAVED_DEAL_NOT_FOUND",
    })
  })

  it("allows a verified internal operator and preserves the principal", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({
      status: "authenticated",
      principal: {
        kind: "internal_operator",
        subject: "operator-123",
      },
    })

    await expect(requireSavedDealReadAccess(request, "deal-1")).resolves.toEqual({
      allowed: true,
      principal: {
        kind: "internal_operator",
        subject: "operator-123",
      },
    })
  })

  it("calls the resolver exactly once for the exact request instance", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthenticated" })

    await requireSavedDealReadAccess(request)

    expect(resolveTrustedInternalOperatorIdentityMock).toHaveBeenCalledTimes(1)
    expect(resolveTrustedInternalOperatorIdentityMock).toHaveBeenCalledWith(request)
  })

  it("does not look up saved deals or the database when a deal id is supplied", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "authenticated", principal: { kind: "internal_operator", subject: "operator-123" } })

    await requireSavedDealReadAccess(request, "deal-1")

    const source = readFileSync(
      path.resolve(process.cwd(), "lib/operator-command/require-saved-deal-read-access.ts"),
      "utf8",
    )

    expect(source).not.toContain("saved-deals-repository")
    expect(source).not.toContain("postgres")
    expect(source).not.toContain("DATABASE_URL")
    expect(source).not.toContain("NextResponse")
  })

  it("supports an omitted deal id without weakening access", async () => {
    const request = new Request("http://localhost/api/saved-deals")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({
      status: "authenticated",
      principal: {
        kind: "internal_operator",
        subject: "operator-123",
      },
    })

    await expect(requireSavedDealReadAccess(request)).resolves.toEqual({
      allowed: true,
      principal: {
        kind: "internal_operator",
        subject: "operator-123",
      },
    })
  })

  it("fails closed if the resolver rejects", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockRejectedValueOnce(new Error("provider exploded"))

    await expect(requireSavedDealReadAccess(request, "deal-1")).resolves.toEqual({
      allowed: false,
      reason: "unauthenticated",
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    })
  })

  it("returns deterministic results for the same mocked identity response", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")
    const identity = {
      status: "authenticated" as const,
      principal: {
        kind: "internal_operator" as const,
        subject: "operator-123",
      },
    }

    resolveTrustedInternalOperatorIdentityMock.mockResolvedValue(identity)
    const first = await requireSavedDealReadAccess(request, "deal-1")
    resolveTrustedInternalOperatorIdentityMock.mockResolvedValue(identity)
    const second = await requireSavedDealReadAccess(request, "deal-1")

    expect(first).toEqual(second)
  })

  describe("development-open security isolation", () => {
    it("allows local dev operator only when NODE_ENV is development and SAVED_DEALS_AUTH_ENFORCEMENT is development-open", async () => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "development-open")

      const request = new Request("http://localhost/api/saved-deals/deal-1")
      const result = await requireSavedDealReadAccess(request, "deal-1")

      expect(result).toEqual({
        allowed: true,
        principal: { kind: "internal_operator", subject: "local-dev-operator" },
      })
      expect(resolveTrustedInternalOperatorIdentityMock).not.toHaveBeenCalled()
      vi.unstubAllEnvs()
    })

    it("fails closed in production even if SAVED_DEALS_AUTH_ENFORCEMENT is set", async () => {
      vi.stubEnv("NODE_ENV", "production")
      vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "development-open")
      resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthenticated" })

      const request = new Request("http://localhost/api/saved-deals/deal-1")
      const result = await requireSavedDealReadAccess(request, "deal-1")

      expect(result).toEqual({
        allowed: false,
        reason: "unauthenticated",
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
      })
      expect(resolveTrustedInternalOperatorIdentityMock).toHaveBeenCalledTimes(1)
      vi.unstubAllEnvs()
    })

    it("fails closed in CI even if SAVED_DEALS_AUTH_ENFORCEMENT is set", async () => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("CI", "true")
      vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "development-open")
      resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthenticated" })

      const request = new Request("http://localhost/api/saved-deals/deal-1")
      const result = await requireSavedDealReadAccess(request, "deal-1")

      expect(result).toEqual({
        allowed: false,
        reason: "unauthenticated",
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
      })
      expect(resolveTrustedInternalOperatorIdentityMock).toHaveBeenCalledTimes(1)
      vi.unstubAllEnvs()
    })

    it("fails closed on Vercel preview even if SAVED_DEALS_AUTH_ENFORCEMENT is set", async () => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("VERCEL_ENV", "preview")
      vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "development-open")
      resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthenticated" })

      const request = new Request("http://localhost/api/saved-deals/deal-1")
      const result = await requireSavedDealReadAccess(request, "deal-1")

      expect(result).toEqual({
        allowed: false,
        reason: "unauthenticated",
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
      })
      expect(resolveTrustedInternalOperatorIdentityMock).toHaveBeenCalledTimes(1)
      vi.unstubAllEnvs()
    })

    it("fails closed in test environment when SAVED_DEALS_AUTH_ENFORCEMENT is set", async () => {
      // Vitest defaults NODE_ENV="test"
      vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "development-open")
      resolveTrustedInternalOperatorIdentityMock.mockResolvedValueOnce({ status: "unauthenticated" })

      const request = new Request("http://localhost/api/saved-deals/deal-1")
      const result = await requireSavedDealReadAccess(request, "deal-1")

      expect(result).toEqual({
        allowed: false,
        reason: "unauthenticated",
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
      })
      vi.unstubAllEnvs()
    })
  })
})
