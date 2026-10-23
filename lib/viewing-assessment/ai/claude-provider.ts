import Anthropic from "@anthropic-ai/sdk"
import type { ChecklistItem } from "@/types/viewing-assessment"
import { buildOutputSchema, buildSystemPrompt, PROMPT_VERSION } from "./prompt"
import type { AnalysisRequest, FrameAnalysisProvider, ProviderOutcome, ProviderUsage } from "./provider"

// LIVE provider adapter for Claude. It is built and unit-tested against a fake client only. In this task it is
// never constructed by any running code path (see select-provider.ts: disabled unless explicitly enabled) and has
// never made a network call.
//
// Open items before the first live call (Task 4B), deliberately not guessed here:
//  - re-verify the model id and its price against the live Models API / pricing page;
//  - add the server-side refusal `fallbacks` option the API reference recommends (needs the beta endpoint; the exact
//    SDK typing for the "default" form is not documented for TypeScript, so it is not assumed);
//  - measure real tokens per frame with count_tokens and recalibrate ESTIMATE_ASSUMPTIONS.

export type ClaudeClient = {
  messages: {
    stream(
      params: Anthropic.MessageStreamParams,
      options?: { signal?: AbortSignal }
    ): { finalMessage(): Promise<Anthropic.Message> }
  }
}

export const DEFAULT_MAX_RETRY_DELAY_MS = 5000

export type ClaudeProviderOptions = {
  client: ClaudeClient
  model: string
  checklist: readonly ChecklistItem[]
  effort?: "low" | "medium" | "high"
  maxRetries?: number
  maxRetryDelayMs?: number
  retryDelayMs?: (attempt: number, retryAfterMs?: number | null) => number
}

const usageOf = (message: Anthropic.Message): ProviderUsage => ({
  inputTokens: message.usage?.input_tokens ?? 0,
  outputTokens: message.usage?.output_tokens ?? 0,
  cacheReadTokens: message.usage?.cache_read_input_tokens ?? 0,
  cacheWriteTokens: message.usage?.cache_creation_input_tokens ?? 0,
})

function isTransientError(error: unknown): boolean {
  if (error instanceof Anthropic.APIConnectionError) {
    return true
  }
  if (error instanceof Anthropic.APIError) {
    const s = error.status
    return s === 408 || s === 429 || s === 500 || s === 502 || s === 503 || s === 504 || s === 529
  }
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    return m.includes("econnreset") || m.includes("etimedout") || m.includes("fetch failed") || m.includes("network")
  }
  return false
}

export function extractRetryAfterMs(error: unknown): number | null {
  if (error instanceof Anthropic.APIError && error.headers) {
    try {
      const getHeader = (name: string): string | null => {
        const h = error.headers as unknown
        if (h && typeof (h as { get?: unknown }).get === "function") {
          return (h as { get: (k: string) => string | null }).get(name)
        }
        if (h && typeof h === "object") {
          const rec = h as Record<string, string>
          return rec[name] ?? rec[name.toLowerCase()] ?? null
        }
        return null
      }

      const msStr = getHeader("retry-after-ms")
      if (msStr !== null && msStr !== undefined) {
        const ms = Number(msStr)
        if (!Number.isNaN(ms) && ms >= 0) return ms
      }

      const secStr = getHeader("retry-after")
      if (secStr !== null && secStr !== undefined) {
        const sec = Number(secStr)
        if (!Number.isNaN(sec) && sec >= 0) return sec * 1000
      }
    } catch {
      // Safe fallback on header parsing error
    }
  }
  return null
}

export function createClaudeProvider({
  client,
  model,
  checklist,
  effort = "medium",
  maxRetries = 2,
  maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
  retryDelayMs = (attempt, retryAfterMs) => {
    if (retryAfterMs !== null && retryAfterMs !== undefined && retryAfterMs >= 0) {
      return Math.min(retryAfterMs, maxRetryDelayMs)
    }
    return process.env.NODE_ENV === "test" ? 0 : Math.min(250 * Math.pow(2, attempt), maxRetryDelayMs)
  },
}: ClaudeProviderOptions): FrameAnalysisProvider {
  const system = buildSystemPrompt(checklist)
  const schema = buildOutputSchema(checklist.map((c) => c.id))

  return {
    id: "claude",
    simulated: false,
    modelVersion: model,
    promptVersion: PROMPT_VERSION,
    needsImages: true,

    async analyse({ assessmentId, frames, limits, signal }: AnalysisRequest): Promise<ProviderOutcome> {
      const content: Anthropic.ContentBlockParam[] = []
      for (const frame of frames) {
        if (!frame.jpeg) return { kind: "error", detail: "a frame image is missing" }
        // The label carries the only ids the model may cite. Pixels come straight from private storage.
        content.push({
          type: "text",
          text: `Frame ${frame.id} at ${frame.timestampSeconds}s${frame.room ? `, room: ${frame.room}` : ""}`,
        })
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(frame.jpeg).toString("base64") },
        })
      }
      content.push({ type: "text", text: "Review these frames against the checklist and return the findings JSON." })

      let message: Anthropic.Message | undefined
      let lastError: unknown

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal.aborted) return { kind: "timeout" }
        try {
          message = await client.messages
            .stream(
              {
                model,
                max_tokens: limits.maxOutputTokens,
                system,
                messages: [{ role: "user", content }],
                output_config: { effort, format: { type: "json_schema", schema } },
              },
              { signal }
            )
            .finalMessage()
          break
        } catch (error) {
          lastError = error
          if (signal.aborted) return { kind: "timeout" }
          if (attempt < maxRetries && isTransientError(error)) {
            const retryAfterMs = extractRetryAfterMs(error)
            const rawDelay = retryDelayMs(attempt, retryAfterMs)
            const delay = Math.min(rawDelay, maxRetryDelayMs)
            if (delay > 0) {
              await new Promise<void>((resolve) => {
                if (signal.aborted) {
                  resolve()
                  return
                }
                const timer = setTimeout(resolve, delay)
                signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer)
                    resolve()
                  },
                  { once: true }
                )
              })
            }
            if (signal.aborted) return { kind: "timeout" }
            continue
          }
          break
        }
      }

      if (!message) {
        if (signal.aborted) return { kind: "timeout" }
        // Status only: never the message body, headers or anything that could echo a credential.
        if (lastError instanceof Anthropic.APIError) {
          return { kind: "error", detail: `provider API error (status ${lastError.status ?? "unknown"})` }
        }
        return { kind: "error", detail: "provider request failed" }
      }

      const usage = usageOf(message)
      if (message.stop_reason === "refusal") {
        return { kind: "refusal", usage, category: message.stop_details?.category ?? undefined }
      }
      if (message.stop_reason === "max_tokens") {
        return { kind: "malformed", usage, detail: "response was cut off at the output limit" }
      }

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return { kind: "malformed", usage, detail: "response was not valid JSON" }
      }
      const findings = (parsed as { findings?: unknown } | null)?.findings
      if (!Array.isArray(findings)) return { kind: "malformed", usage, detail: "response had no findings array" }

      // Untrusted until validateAiProposals accepts it.
      return {
        kind: "ok",
        usage,
        envelope: { kind: "brik-ai-findings", version: 1, assessmentId, modelVersion: model, findings },
      }
    },
  }
}
