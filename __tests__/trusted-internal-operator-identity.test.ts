import { describe, expect, it } from "vitest"

import { resolveTrustedInternalOperatorIdentity } from "@/lib/operator-command/trusted-internal-operator-identity"

describe("trusted internal operator identity resolver", () => {
  it("fails closed for arbitrary client headers", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1", {
      headers: {
        "x-user-id": "user-123",
        "x-role": "admin",
        "x-internal-operator": "true",
        referer: "https://example.invalid",
        origin: "https://example.invalid",
      },
    })

    await expect(resolveTrustedInternalOperatorIdentity(request)).resolves.toEqual({
      status: "unauthenticated",
    })
  })

  it("stays deterministic without provider configuration", async () => {
    const request = new Request("http://localhost/api/saved-deals/deal-1")

    await expect(resolveTrustedInternalOperatorIdentity(request)).resolves.toEqual({
      status: "unauthenticated",
    })
    await expect(resolveTrustedInternalOperatorIdentity(request)).resolves.toEqual({
      status: "unauthenticated",
    })
  })
})
