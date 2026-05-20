import { describe, expect, it } from "vitest"
import * as enforcementContracts from "@/types/phase3-enforcement"

describe("Phase 3A-4 safe runtime and version metadata contracts", () => {
  it("runtime mode is safe_runtime_mode", () => {
    expect(enforcementContracts.PHASE3A4_RUNTIME_MODES).toEqual(["safe_runtime_mode"])
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.runtimeMode).toBe("safe_runtime_mode")
  })

  it("sandbox rules include all required no-action rules", () => {
    expect(enforcementContracts.PHASE3A4_SANDBOX_RULES).toEqual(
      expect.arrayContaining([
        "no_persistence",
        "no_external_actions",
        "no_live_workflow_mutation",
        "no_crm_action",
        "no_automated_offer_action",
      ])
    )
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.sandboxRules).toEqual(
      expect.arrayContaining([
        "no_persistence",
        "no_external_actions",
        "no_live_workflow_mutation",
        "no_crm_action",
        "no_automated_offer_action",
      ])
    )
  })

  it("allowsPersistence is false", () => {
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.allowsPersistence).toBe(false)
  })

  it("allowsExternalActions is false", () => {
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.allowsExternalActions).toBe(false)
  })

  it("allowsLiveWorkflowMutation is false", () => {
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.allowsLiveWorkflowMutation).toBe(false)
  })

  it("allowsCrmAction is false", () => {
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.allowsCrmAction).toBe(false)
  })

  it("allowsAutomatedOfferAction is false", () => {
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.allowsAutomatedOfferAction).toBe(false)
  })

  it("governanceVersion metadata includes phase-3A-4", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_VERSION_METADATA.governanceVersion).toBe("phase-3A-4")
  })

  it("doctrineVersion is phase-3A-2", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_VERSION_METADATA.doctrineVersion).toBe("phase-3A-2")
  })

  it("enforcementVersion is phase-3A-3", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_VERSION_METADATA.enforcementVersion).toBe("phase-3A-3")
  })

  it("runtimeIntegrationVersion is phase-3A-4", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_VERSION_METADATA.runtimeIntegrationVersion).toBe("phase-3A-4")
  })

  it("advisoryOnly is true on metadata and runtime contract", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_VERSION_METADATA.advisoryOnly).toBe(true)
    expect(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT.advisoryOnly).toBe(true)
  })

  it("no runtime fields exist on safe runtime contracts", () => {
    const forbiddenFields = [
      "execute",
      "enforce",
      "apply",
      "mutate",
      "persist",
      "fetch",
      "api",
      "aiModel",
      "database",
      "routeHandler",
      "handler",
    ]

    for (const key of Object.keys(enforcementContracts.PHASE3A4_GOVERNANCE_VERSION_METADATA)) {
      expect(forbiddenFields).not.toContain(key)
    }

    for (const key of Object.keys(enforcementContracts.PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT)) {
      expect(forbiddenFields).not.toContain(key)
    }
  })

  it("no runtime resolver function is exported", () => {
    expect("resolvePhase3A4RuntimeMode" in enforcementContracts).toBe(false)
    expect("applyPhase3A4RuntimeMode" in enforcementContracts).toBe(false)
    expect("buildPhase3A4GovernanceVersion" in enforcementContracts).toBe(false)
  })
})
