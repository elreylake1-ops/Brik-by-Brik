"use client"

import { useEffect, useState } from "react"
import { formatClock } from "@/lib/viewing-assessment/capture/capture-logic"

// One evidence frame: its picture (when an image was stored) and its ACTUAL recorded time.
//
// The picture is fetched with credentials, as a blob, rather than put in an <img src>. That is deliberate: images are
// served only to authenticated operators, and a plain <img> cannot send an Authorization header. Until a login layer
// exists the request is refused (401) and the thumbnail says so instead of pretending: it never falls back to a
// public URL. The time label is always shown, whether or not the picture loads.

type Props = {
  /** URL of the authenticated image route for this frame. */
  src: string
  hasImage: boolean
  timestampSeconds: number
  room?: string
  clipFilename?: string
  fetchImpl?: typeof fetch
  /** Authentication headers from the login layer, once it exists. */
  headers?: () => Record<string, string>
}

type View = { kind: "loading" } | { kind: "ready"; url: string } | { kind: "unavailable"; reason: string }

const reasonFor = (status: number) =>
  status === 401 ? "sign in to view the image" : status === 404 || status === 410 ? "image no longer stored" : status === 503 ? "storage unavailable here" : "image unavailable"

export default function FrameThumb({ src, hasImage, timestampSeconds, room, clipFilename, fetchImpl, headers }: Props) {
  const [view, setView] = useState<View>({ kind: "loading" })

  useEffect(() => {
    if (!hasImage) return
    const controller = new AbortController()
    let objectUrl: string | null = null
    ;(async () => {
      try {
        const response = await (fetchImpl ?? fetch)(src, { credentials: "same-origin", signal: controller.signal, headers: headers?.() })
        if (!response.ok) return setView({ kind: "unavailable", reason: reasonFor(response.status) })
        objectUrl = URL.createObjectURL(await response.blob())
        setView({ kind: "ready", url: objectUrl })
      } catch {
        if (!controller.signal.aborted) setView({ kind: "unavailable", reason: "image unavailable" })
      }
    })()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, hasImage, fetchImpl, headers])

  const caption = `${formatClock(timestampSeconds)}${room ? ` · ${room}` : ""}`
  const exact = `${timestampSeconds.toFixed(2)} s into ${clipFilename ?? "the clip"}`
  return (
    <figure className="w-28 text-xs" data-testid="frame-thumb">
      {!hasImage ? (
        <div className="flex h-16 items-center justify-center rounded border border-dashed border-slate-300 p-1 text-center text-slate-500" data-testid="frame-no-image">
          no image stored
        </div>
      ) : view.kind === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL; next/image cannot fetch with credentials
        <img src={view.url} alt={`Frame at ${caption}`} className="h-16 w-full rounded object-cover" />
      ) : (
        <div className="flex h-16 items-center justify-center rounded border border-slate-300 bg-slate-50 p-1 text-center text-slate-600" data-testid="frame-pending">
          {view.kind === "loading" ? "loading…" : view.reason}
        </div>
      )}
      <figcaption className="mt-0.5 text-slate-700" title={exact} data-testid="frame-time">
        {caption}
      </figcaption>
    </figure>
  )
}
