import type {
  AiFindingsEnvelope,
  VideoAnalysisInput,
  VideoAnalysisService,
} from "@/types/viewing-assessment"

// Deterministic stand-in for the real server-side multimodal provider. No network, no credentials.
// Output is untrusted by design and must go through validateAiProposals like real provider output.

export const MOCK_MODEL_VERSION = "mock-video-analysis-v1"

const PATTERN = [
  { checkId: "C08", status: "concern", observation: "Render appears cracked near the frame." },
  { checkId: "C11", status: "observed", observation: "Window frame visible; operation not shown." },
  { checkId: "C10", status: "specialist", observation: "Crack-like line visible; cause needs assessment." },
] as const

export const mockVideoAnalysisService: VideoAnalysisService = {
  modelVersion: MOCK_MODEL_VERSION,
  async analyse({ assessmentId, evidence }: VideoAnalysisInput): Promise<AiFindingsEnvelope> {
    // One finding per real evidence ref, in id order. No evidence -> no findings (nothing invented).
    const findings = [...evidence]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((ref, i) => ({
        ...PATTERN[i % PATTERN.length],
        frameIds: [ref.id],
        ...(ref.room ? { room: ref.room } : {}),
        confidence: "low" as const,
      }))
    return {
      kind: "brik-ai-findings",
      version: 1,
      assessmentId,
      modelVersion: MOCK_MODEL_VERSION,
      findings,
    }
  },
}
