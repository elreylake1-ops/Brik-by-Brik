import type {
  Phase3EvidenceBundle,
  Phase3EvidenceBundleValidationResult,
} from "@/types/phase3-evidence"

const REVIEW_REQUIRED_STATUSES: readonly string[] = ["missing", "weak", "conflicting"]

const RESERVED_SOURCE_LABELS: readonly string[] = ["future_ai_extracted", "future_integration"]

export function validatePhase3EvidenceBundle(
  bundle: Phase3EvidenceBundle
): Phase3EvidenceBundleValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const seenIds = new Set<string>()

  if (bundle.advisoryOnly !== true) {
    errors.push("bundle.advisoryOnly must be true")
  }

  let requiresReview = false

  for (const item of bundle.items) {
    if (item.advisoryOnly !== true) {
      errors.push(`item ${item.id} advisoryOnly must be true`)
    }

    if (seenIds.has(item.id)) {
      warnings.push(`duplicate item id detected: ${item.id}`)
    } else {
      seenIds.add(item.id)
    }

    if (RESERVED_SOURCE_LABELS.includes(item.source)) {
      warnings.push(`reserved source label only: ${item.id} uses ${item.source}`)
    }

    if (item.status === "accepted") {
      warnings.push(
        `accepted evidence is advisory only and does not imply deterministic approval: ${item.id}`
      )
    }

    if (REVIEW_REQUIRED_STATUSES.includes(item.status)) {
      requiresReview = true
    }
  }

  if (requiresReview && bundle.reviewRequired !== true) {
    errors.push("bundle.reviewRequired must be true when missing, weak, or conflicting evidence exists")
  }

  if (bundle.items.length === 0 && bundle.confidence !== "unknown") {
    warnings.push("empty evidence bundle should use confidence 'unknown'")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requiresReview,
  }
}
