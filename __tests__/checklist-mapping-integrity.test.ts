import { describe, expect, it } from "vitest"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import {
  FINDING_WORK_MAPPINGS,
  mappingForCheck,
  MAPPED_CHECK_IDS,
} from "@/lib/data/finding-work-mapping"
import {
  buildWorkProposal,
  type BuildWorkProposalInput,
} from "@/lib/refurb-integration/findings-to-work"
import { selectExtractionTimestamps } from "@/lib/viewing-assessment/video/video-extraction-worker"
import { buildEvaluationDataset } from "@/lib/viewing-assessment/evaluation/dataset"
import type { ProposalWithReview, VideoEvidenceRef } from "@/types/viewing-assessment"

describe("Checklist Mapping & Demonstration Integrity (Task 12A-1)", () => {
  // =========================================================================
  // 1. Canonical Checklist Verification (C01-C45, V01-V13)
  // =========================================================================
  describe("Canonical Checklist Item Verification", () => {
    it("contains exactly 58 checklist items: 45 core inspection checks and 13 viewing checks", () => {
      expect(VIEWING_CHECKLIST_V1).toHaveLength(58)
      const core = VIEWING_CHECKLIST_V1.filter((c) => c.source === "45-check inspection")
      const viewing = VIEWING_CHECKLIST_V1.filter((c) => c.source === "Viewing supplement")
      expect(core).toHaveLength(45)
      expect(viewing).toHaveLength(13)
    })

    it("verifies C09 is strictly 'Mortar joint pointing' under group 'External walls'", () => {
      const c09 = VIEWING_CHECKLIST_V1.find((c) => c.id === "C09")
      expect(c09).toBeDefined()
      expect(c09!.group).toBe("External walls")
      expect(c09!.title).toBe("Mortar joint pointing")
      expect(c09!.prompt).toContain("Check external wall mortar joints across all visible elevations")
      // Explicitly assert it is NOT roof
      expect(c09!.group).not.toBe("Roof")
      expect(c09!.title).not.toContain("roof")
    })

    it("verifies C12 is strictly 'Insulated double glazing unit seals' under group 'External glazing and doors'", () => {
      const c12 = VIEWING_CHECKLIST_V1.find((c) => c.id === "C12")
      expect(c12).toBeDefined()
      expect(c12!.group).toBe("External glazing and doors")
      expect(c12!.title).toBe("Insulated double glazing unit seals")
      expect(c12!.prompt).toContain("Examine double or triple glazed panes for internal condensation")
      // Explicitly assert it is NOT external walls
      expect(c12!.group).not.toBe("External walls")
    })

    it("verifies C18 is strictly 'Textured decorative ceiling coatings' under group 'Ceilings'", () => {
      const c18 = VIEWING_CHECKLIST_V1.find((c) => c.id === "C18")
      expect(c18).toBeDefined()
      expect(c18!.group).toBe("Ceilings")
      expect(c18!.title).toBe("Textured decorative ceiling coatings")
      expect(c18!.prompt).toContain("Identify textured or artex pattern coatings on ceiling surfaces")
      // Explicitly assert it is NOT damp or timber
      expect(c18!.group).not.toBe("Internal walls")
      expect(c18!.title).not.toContain("Damp")
    })

    it("verifies Roof checks are strictly C01, C02, and C03", () => {
      const roofChecks = VIEWING_CHECKLIST_V1.filter((c) => c.group === "Roof")
      expect(roofChecks.map((c) => c.id)).toEqual(["C01", "C02", "C03"])
      expect(roofChecks[0].title).toBe("Main roof pitched covering")
      expect(roofChecks[1].title).toBe("Roof line ridge and pitch profile")
      expect(roofChecks[2].title).toBe("Flat roof membranes and decks")
    })

    it("verifies Dampness check is strictly C22 under group 'Internal walls'", () => {
      const c22 = VIEWING_CHECKLIST_V1.find((c) => c.id === "C22")
      expect(c22).toBeDefined()
      expect(c22!.group).toBe("Internal walls")
      expect(c22!.title).toBe("Dampness signs, salt efflorescence and mould")
    })
  })

  // =========================================================================
  // 2. Refurbishment Finding-to-Work Mapping Logic Verification
  // =========================================================================
  describe("Refurbishment Finding-to-Work Mapping Logic", () => {
    it("maps C09 to 'external-walls' (Facade and masonry repairs), NOT roof", () => {
      const mapping = mappingForCheck("C09")
      expect(mapping).toBeDefined()
      expect(mapping!.id).toBe("external-walls")
      expect(mapping!.label).toBe("Facade and masonry repairs")
      expect(mapping!.kind).toBe("UNPRICED")
      expect(mapping!.area).toBe("facade")
      expect(mapping!.checkIds).toContain("C09")
      expect(mapping!.id).not.toBe("roof")
    })

    it("maps C12 to 'windows-doors' (Windows and external doors), NOT external-walls", () => {
      const mapping = mappingForCheck("C12")
      expect(mapping).toBeDefined()
      expect(mapping!.id).toBe("windows-doors")
      expect(mapping!.label).toBe("Windows and external doors")
      expect(mapping!.kind).toBe("UNPRICED")
      expect(mapping!.area).toBe("windows and doors")
      expect(mapping!.checkIds).toContain("C12")
      expect(mapping!.id).not.toBe("external-walls")
    })

    it("maps C18 to 'ceilings' (Ceiling repairs), NOT internal-walls or damp/timber", () => {
      const mapping = mappingForCheck("C18")
      expect(mapping).toBeDefined()
      expect(mapping!.id).toBe("ceilings")
      expect(mapping!.label).toBe("Ceiling repairs")
      expect(mapping!.kind).toBe("UNPRICED")
      expect(mapping!.area).toBe("ceilings")
      expect(mapping!.checkIds).toContain("C18")
      expect(mapping!.id).not.toBe("internal-walls")
    })

    it("verifies all mapped check IDs exist in the canonical checklist", () => {
      const checklistIds = new Set(VIEWING_CHECKLIST_V1.map((c) => c.id))
      for (const mappedId of MAPPED_CHECK_IDS) {
        expect(checklistIds.has(mappedId)).toBe(true)
      }
    })
  })

  // =========================================================================
  // 3. Finding-to-Work Proposal Generation & Rejection Safeguards
  // =========================================================================
  describe("Refurbishment Scope Proposal & Safeguards", () => {
    const evidence: VideoEvidenceRef[] = [
      { id: "ev-c09", assetId: "ast-1", timestampSeconds: 1.0, room: "Front elevation" },
      { id: "ev-c12", assetId: "ast-1", timestampSeconds: 2.0, room: "Living room window" },
      { id: "ev-c18", assetId: "ast-1", timestampSeconds: 3.0, room: "Bedroom ceiling" },
      { id: "ev-c01", assetId: "ast-1", timestampSeconds: 4.0, room: "Main roof slope" },
    ]

    function makeProposal(
      proposalId: string,
      checkId: string,
      evidenceId: string,
      review: { disposition: "ACCEPTED" | "EDITED" | "REJECTED"; status?: "CONCERN" | "SPECIALIST_REVIEW" } | null
    ): ProposalWithReview {
      const storedReview = review
        ? {
            id: `rev-${proposalId}`,
            proposalId,
            revision: 1,
            disposition: review.disposition,
            status: review.status ?? "CONCERN",
            editedStatus: review.status ?? "CONCERN",
            editedObservation: null,
            reason: review.disposition === "REJECTED" ? "Superficial only" : null,
            reviewerId: "james-lake-operator",
            reviewedAt: "2026-10-23T10:05:00Z",
          }
        : null

      return {
        proposal: {
          id: proposalId,
          runId: "run-1",
          assessmentId: "asmt-1",
          checkId,
          status: "CONCERN",
          observation: `Observed condition for ${checkId}`,
          confidence: "high",
          evidenceIds: [evidenceId],
          verification: "UNVERIFIED",
          disposition: "PENDING",
          modelVersion: "test-model-v1",
          createdAt: "2026-10-23T10:00:00Z",
        },
        currentReview: storedReview,
        reviewHistory: storedReview ? [storedReview] : [],
      }
    }

    it("generates correct work items when C09, C12, C18 are human-accepted", () => {
      const proposals: ProposalWithReview[] = [
        makeProposal("p-c09", "C09", "ev-c09", { disposition: "ACCEPTED" }),
        makeProposal("p-c12", "C12", "ev-c12", { disposition: "ACCEPTED" }),
        makeProposal("p-c18", "C18", "ev-c18", { disposition: "ACCEPTED" }),
      ]

      const input: BuildWorkProposalInput = {
        assessmentId: "asmt-1",
        analysisSource: "SIMULATED",
        evidence,
        proposals,
        checkIds: VIEWING_CHECKLIST_V1.map((c) => c.id),
      }

      const result = buildWorkProposal(input)
      expect(result.items).toHaveLength(3)

      const item09 = result.items.find((i) => i.mappingId === "external-walls")
      expect(item09).toBeDefined()
      expect(item09!.label).toBe("Facade and masonry repairs")
      expect(item09!.sources[0].checkId).toBe("C09")

      const item12 = result.items.find((i) => i.mappingId === "windows-doors")
      expect(item12).toBeDefined()
      expect(item12!.label).toBe("Windows and external doors")
      expect(item12!.sources[0].checkId).toBe("C12")

      const item18 = result.items.find((i) => i.mappingId === "ceilings")
      expect(item18).toBeDefined()
      expect(item18!.label).toBe("Ceiling repairs")
      expect(item18!.sources[0].checkId).toBe("C18")

      // Roof must NOT be proposed
      expect(result.items.some((i) => i.mappingId === "roof")).toBe(false)
    })

    it("guarantees REJECTED or UNVERIFIED findings NEVER generate work items", () => {
      const proposals: ProposalWithReview[] = [
        makeProposal("p-c09", "C09", "ev-c09", { disposition: "REJECTED" }), // rejected
        makeProposal("p-c12", "C12", "ev-c12", null), // unreviewed / pending
        makeProposal("p-c01", "C01", "ev-c01", { disposition: "ACCEPTED" }), // accepted roof
      ]

      const input: BuildWorkProposalInput = {
        assessmentId: "asmt-1",
        analysisSource: "SIMULATED",
        evidence,
        proposals,
        checkIds: VIEWING_CHECKLIST_V1.map((c) => c.id),
      }

      const result = buildWorkProposal(input)

      // Only C01 (roof) should be in items
      expect(result.items).toHaveLength(1)
      expect(result.items[0].mappingId).toBe("roof")
      expect(result.items[0].sources[0].checkId).toBe("C01")

      // C09 must be in excluded with REJECTED
      const excl09 = result.excluded.find((e) => e.checkId === "C09")
      expect(excl09).toBeDefined()
      expect(excl09!.reason).toBe("REJECTED")

      // C12 must be in excluded with UNREVIEWED
      const excl12 = result.excluded.find((e) => e.checkId === "C12")
      expect(excl12).toBeDefined()
      expect(excl12!.reason).toBe("UNREVIEWED")
    })

    it("excludes findings that lack resolvable evidence frames", () => {
      const proposals: ProposalWithReview[] = [
        makeProposal("p-c09-ghost", "C09", "ghost-frame-id", { disposition: "ACCEPTED" }),
      ]

      const input: BuildWorkProposalInput = {
        assessmentId: "asmt-1",
        analysisSource: "SIMULATED",
        evidence, // does not contain ghost-frame-id
        proposals,
        checkIds: VIEWING_CHECKLIST_V1.map((c) => c.id),
      }

      const result = buildWorkProposal(input)
      expect(result.items).toHaveLength(0)
      const excl = result.excluded.find((e) => e.checkId === "C09")
      expect(excl).toBeDefined()
      expect(excl!.reason).toBe("NO_EVIDENCE")
    })
  })

  // =========================================================================
  // 4. Timestamp Accuracy & VFR Probing Verification
  // =========================================================================
  describe("Timestamp Accuracy & Variable-Frame-Rate (VFR) Probing", () => {
    it("selects presentation timestamps directly from probed packet timestamps", () => {
      // Simulated VFR stream presentation timestamps (irregular intervals)
      const vfrPts = [0.0, 0.12, 0.35, 0.58, 0.95, 1.25, 1.78, 2.15, 2.65, 3.0]
      const selected = selectExtractionTimestamps(vfrPts, 3.0, 5)

      expect(selected.length).toBeGreaterThanOrEqual(5)
      // Every selected timestamp must be an exact element of the genuine probed PTS array
      for (const t of selected) {
        expect(vfrPts).toContain(t)
      }
      // Must be strictly chronological
      for (let i = 1; i < selected.length; i++) {
        expect(selected[i]).toBeGreaterThan(selected[i - 1])
      }
    })
  })

  // =========================================================================
  // 5. Continuous Learning Data Integrity & Simulation Labeling
  // =========================================================================
  describe("Learning Dataset Safety & Simulation Isolation", () => {
    it("excludes simulated records by default unless explicitly included", () => {
      const dataset = buildEvaluationDataset({
        dealId: "deal-1",
        assessments: [
          {
            assessment: {
              id: "asmt-1",
              dealId: "deal-1",
              status: "COMPLETED",
              reference: "REF-1",
              leadSurveyor: "James Lake",
              createdAt: "2026-10-23T10:00:00Z",
              updatedAt: "2026-10-23T10:00:00Z",
            },
            proposals: [
              {
                proposal: {
                  id: "prop-sim-1",
                  runId: "run-sim-1",
                  assessmentId: "asmt-1",
                  checkId: "C01",
                  status: "concern",
                  observation: "Simulated observation",
                  confidence: "high",
                  evidenceIds: ["ev-1"],
                  verification: "UNVERIFIED",
                  disposition: "PENDING",
                  modelVersion: "fixture-frame-analysis-v1",
                  createdAt: "2026-10-23T10:00:00Z",
                },
                currentReview: null,
                reviewHistory: [],
              },
            ],
            runs: [
              {
                id: "run-sim-1",
                assessmentId: "asmt-1",
                provider: "fixture",
                modelVersion: "fixture-frame-analysis-v1",
                promptVersion: "fixture-prompt-v1",
                simulated: true,
                status: "SUCCEEDED",
                attempt: 1,
                runStartedAt: "2026-10-23T10:00:00Z",
                runCompletedAt: "2026-10-23T10:00:01Z",
                failureReason: null,
              },
            ],
            evidence: [{ id: "ev-1", assetId: "ast-1", timestampSeconds: 1.0, room: "Roof" }],
            blobs: [],
            feedback: [],
            usage: [],
          },
        ],
        includeSimulated: false, // Default safety guard
        generatedAt: new Date("2026-10-23T10:10:00Z"),
      })

      // When includeSimulated is false, simulated records must be 0 and excluded count incremented
      expect(dataset.records).toHaveLength(0)
      expect(dataset.excludedSimulated).toBe(1)
    })

    it("clearly labels simulated records when explicitly exported", () => {
      const dataset = buildEvaluationDataset({
        dealId: "deal-1",
        assessments: [
          {
            assessment: {
              id: "asmt-1",
              dealId: "deal-1",
              status: "COMPLETED",
              reference: "REF-1",
              leadSurveyor: "James Lake",
              createdAt: "2026-10-23T10:00:00Z",
              updatedAt: "2026-10-23T10:00:00Z",
            },
            proposals: [
              {
                proposal: {
                  id: "prop-sim-1",
                  runId: "run-sim-1",
                  assessmentId: "asmt-1",
                  checkId: "C09",
                  status: "concern",
                  observation: "Simulated observation",
                  confidence: "high",
                  evidenceIds: ["ev-1"],
                  verification: "UNVERIFIED",
                  disposition: "PENDING",
                  modelVersion: "fixture-frame-analysis-v1",
                  createdAt: "2026-10-23T10:00:00Z",
                },
                currentReview: null,
                reviewHistory: [],
              },
            ],
            runs: [
              {
                id: "run-sim-1",
                assessmentId: "asmt-1",
                provider: "fixture",
                modelVersion: "fixture-frame-analysis-v1",
                promptVersion: "fixture-prompt-v1",
                simulated: true,
                status: "SUCCEEDED",
                attempt: 1,
                runStartedAt: "2026-10-23T10:00:00Z",
                runCompletedAt: "2026-10-23T10:00:01Z",
                failureReason: null,
              },
            ],
            evidence: [{ id: "ev-1", assetId: "ast-1", timestampSeconds: 1.0, room: "Exterior" }],
            blobs: [],
            feedback: [],
            usage: [],
          },
        ],
        includeSimulated: true,
        generatedAt: new Date("2026-10-23T10:10:00Z"),
      })

      expect(dataset.records).toHaveLength(1)
      expect(dataset.records[0].simulated).toBe(true)
      expect(dataset.records[0].checkId).toBe("C09")
      expect(dataset.records[0].run.provider).toBe("fixture")
    })
  })
})
