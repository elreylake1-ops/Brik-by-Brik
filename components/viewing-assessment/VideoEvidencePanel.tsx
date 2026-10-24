/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useRef, useState } from "react"
import { createResumableTusUpload, type TusUploadController, type UploadProgress } from "@/lib/viewing-assessment/capture/resumable-tus-uploader"
import type { SafeVideoFrame, SafeVideoJob, VideoIntentResponse } from "@/types/video-jobs"
import type { CheckMeta } from "./ChecklistReview"

export type VideoEvidencePanelProps = {
  dealId: string
  assessmentId: string
  checks: readonly CheckMeta[]
  onEvidenceAttached?: () => void
  fetchImpl?: typeof fetch
  headers?: () => Record<string, string>
}

const BUTTON_PRIMARY = "rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
const BUTTON_SECONDARY = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
const BUTTON_DANGER = "rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"

function formatMmSs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function VideoEvidencePanel({
  dealId,
  assessmentId,
  checks,
  onEvidenceAttached,
  fetchImpl = fetch,
  headers,
}: VideoEvidencePanelProps) {
  const [jobs, setJobs] = useState<SafeVideoJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [activeJobDetail, setActiveJobDetail] = useState<SafeVideoJob | null>(null)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [uploadPaused, setUploadPaused] = useState(false)
  const uploadControllerRef = useRef<TusUploadController | null>(null)

  // Frame inspection & attachment modal state
  const [inspectedFrame, setInspectedFrame] = useState<SafeVideoFrame | null>(null)
  const [attachingFrame, setAttachingFrame] = useState<SafeVideoFrame | null>(null)
  const [attachCheckId, setAttachCheckId] = useState<string>(checks[0]?.id || "C01")
  const [attachStatus, setAttachStatus] = useState<"OBSERVED" | "CONCERN" | "SPECIALIST_REVIEW">("OBSERVED")
  const [attachObservation, setAttachObservation] = useState("")
  const [attachRoom, setAttachRoom] = useState("")
  const [attachingBusy, setAttachingBusy] = useState(false)
  const [workerBusy, setWorkerBusy] = useState(false)

  // Contact sheet modal state
  const [showContactSheet, setShowContactSheet] = useState(false)

  const baseApi = `/api/saved-deals/${encodeURIComponent(dealId)}/viewing-assessments/${encodeURIComponent(assessmentId)}/videos`

  const refreshJobDetail = async (jobId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetchImpl(`${baseApi}/${encodeURIComponent(jobId)}`, {
        headers: headers?.() ?? {},
      })
      if (!res.ok) return
      const data = (await res.json()) as { success: boolean; job: SafeVideoJob }
      if (data.success && data.job) {
        setActiveJobDetail(data.job)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDetail(false)
    }
  }

  const refreshJobs = async () => {
    setLoadingJobs(true)
    try {
      const res = await fetchImpl(baseApi, {
        headers: headers?.() ?? {},
      })
      if (!res.ok) return
      const data = (await res.json()) as { success: boolean; jobs: SafeVideoJob[] }
      if (data.success && data.jobs) {
        setJobs(data.jobs)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingJobs(false)
    }
  }

  const triggerWorker = async () => {
    setWorkerBusy(true)
    setStatusMessage("Running media extraction worker via FFmpeg...")
    setErrorMessage(null)
    try {
      const res = await fetchImpl("/api/qa/video-worker/cycle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers?.() ?? {}),
        },
        body: JSON.stringify({ dealId }),
      })
      const data = await res.json()
      if (data.success && data.result) {
        setStatusMessage(`Worker completed: extracted ${data.result.frameCount} genuine frames (${formatMmSs(data.result.durationMs)}).`)
        if (selectedJobId) {
          await refreshJobDetail(selectedJobId)
        }
        await refreshJobs()
      } else {
        setErrorMessage(data.error || "Worker run failed.")
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setWorkerBusy(false)
    }
  }

  useEffect(() => {
    let ignore = false
    async function init() {
      setLoadingJobs(true)
      try {
        const res = await fetchImpl(baseApi, {
          headers: headers?.() ?? {},
        })
        if (!res.ok) return
        const data = (await res.json()) as { success: boolean; jobs: SafeVideoJob[] }
        if (!ignore && data.success && data.jobs) {
          setJobs(data.jobs)
          if (data.jobs.length > 0) {
            setSelectedJobId(data.jobs[0].id)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!ignore) setLoadingJobs(false)
      }
    }
    init()
    return () => {
      ignore = true
    }
  }, [baseApi, fetchImpl, headers])

  useEffect(() => {
    let ignore = false
    if (!selectedJobId) {
      return
    }
    async function load() {
      try {
        const res = await fetchImpl(`${baseApi}/${encodeURIComponent(selectedJobId!)}`, {
          headers: headers?.() ?? {},
        })
        if (!res.ok) return
        const data = (await res.json()) as { success: boolean; job: SafeVideoJob }
        if (!ignore && data.success && data.job) {
          setActiveJobDetail(data.job)
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [selectedJobId, baseApi, fetchImpl, headers])

  // File selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null)
    setStatusMessage(null)
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }

    const lower = file.name.toLowerCase()
    const validExt = lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".m4v")
    if (!validExt) {
      setErrorMessage("Unsupported file extension. Only MP4 and MOV walkthrough footage is permitted.")
      e.target.value = ""
      setSelectedFile(null)
      return
    }

    if (file.size > 524_288_000) {
      setErrorMessage("File exceeds 500 MB maximum size limit.")
      e.target.value = ""
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  // Resumable upload flow
  async function startUpload() {
    if (!selectedFile) return
    setErrorMessage(null)
    setStatusMessage(null)
    setUploading(true)
    setUploadProgress({ bytesUploaded: 0, totalBytes: selectedFile.size, percentage: 0 })
    setUploadPaused(false)

    try {
      // Step 1: Request upload intent from API
      const intentRes = await fetchImpl(baseApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers?.() ?? {}),
        },
        body: JSON.stringify({
          contentType: selectedFile.type || "video/mp4",
          declaredBytes: selectedFile.size,
          filename: selectedFile.name,
        }),
      })

      if (!intentRes.ok) {
        const errData = await intentRes.json().catch(() => ({}))
        throw new Error(errData.message || errData.error || `Upload intent failed (HTTP ${intentRes.status})`)
      }

      const intent = (await intentRes.json()) as VideoIntentResponse
      const jobId = intent.jobId

      // Step 2: Initialize direct private TUS uploader
      const controller = createResumableTusUpload({
        file: selectedFile,
        protocols: intent.protocols,
        fetchImpl,
        onProgress: (p) => {
          setUploadProgress(p)
        },
        onSuccess: async () => {
          setUploading(false)
          setUploadProgress(null)
          setStatusMessage("Upload completed. Confirming upload with server...")

          // Step 3: Confirm upload with server API to queue job for worker
          try {
            const confirmRes = await fetchImpl(`${baseApi}/${encodeURIComponent(jobId)}/confirm`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(headers?.() ?? {}),
              },
              body: JSON.stringify({}),
            })

            if (!confirmRes.ok) {
              const confirmErr = await confirmRes.json().catch(() => ({}))
              throw new Error(confirmErr.message || `Confirmation failed (HTTP ${confirmRes.status})`)
            }

            setStatusMessage("Video queued successfully for server-side frame extraction.")
            setSelectedFile(null)
            await refreshJobs()
            setSelectedJobId(jobId)
          } catch (confirmError) {
            setErrorMessage(confirmError instanceof Error ? confirmError.message : String(confirmError))
          }
        },
        onError: (err) => {
          setUploading(false)
          setErrorMessage(`Upload error: ${err.message}`)
        },
      })

      uploadControllerRef.current = controller
      await controller.start()
    } catch (err) {
      setUploading(false)
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  function togglePause() {
    if (!uploadControllerRef.current) return
    if (uploadPaused) {
      uploadControllerRef.current.resume()
      setUploadPaused(false)
    } else {
      uploadControllerRef.current.pause()
      setUploadPaused(true)
    }
  }

  function cancelUpload() {
    uploadControllerRef.current?.abort()
    setUploading(false)
    setUploadProgress(null)
    setUploadPaused(false)
    setStatusMessage("Upload cancelled by operator.")
  }

  // Attach frame to checklist
  async function submitFrameAttachment(e: React.FormEvent) {
    e.preventDefault()
    if (!activeJobDetail || !attachingFrame) return

    setAttachingBusy(true)
    setErrorMessage(null)

    try {
      const attachUrl = `${baseApi}/${encodeURIComponent(activeJobDetail.id)}/attach`
      const res = await fetchImpl(attachUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers?.() ?? {}),
        },
        body: JSON.stringify({
          frameId: attachingFrame.id,
          checkId: attachCheckId,
          status: attachStatus,
          observation: attachObservation,
          room: attachRoom,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || `Attachment failed (HTTP ${res.status})`)
      }

      setStatusMessage(`Frame ${attachingFrame.sequenceNo} attached to check ${attachCheckId} as an unreviewed suggestion. Review it in the checklist below.`)
      setAttachingFrame(null)
      setAttachObservation("")
      setAttachRoom("")

      // Refresh parent viewing assessment and current job
      onEvidenceAttached?.()
      await refreshJobDetail(activeJobDetail.id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setAttachingBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="video-evidence-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-6"
      data-testid="video-evidence-panel"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <h3 id="video-evidence-heading" className="text-lg font-bold text-slate-900">
              Walkthrough Video-to-Evidence
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Resumable direct upload · Genuine unenhanced frames · Cryptographic timestamp provenance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={BUTTON_SECONDARY}
            onClick={() => refreshJobs()}
            disabled={loadingJobs}
          >
            {loadingJobs ? "Refreshing..." : "Refresh Queue"}
          </button>
        </div>
      </div>

      {/* Status & Error Alerts */}
      {statusMessage && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
          {errorMessage}
        </div>
      )}

      {/* Upload Section (Android-friendly responsive cards) */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 sm:p-5">
        <div className="text-sm font-semibold text-slate-900">Upload Walkthrough Footage</div>
        <p className="mt-1 text-xs text-slate-600">
          H.264 or H.265 in MP4/MOV container · Maximum 500 MB · Duration up to 5 minutes · Direct private TUS upload (6 MB chunks)
        </p>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex-1">
            <span className="sr-only">Choose video file</span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              disabled={uploading}
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700 cursor-pointer"
            />
          </label>

          {selectedFile && !uploading && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">
                {formatBytes(selectedFile.size)}
              </span>
              <button
                type="button"
                className={BUTTON_PRIMARY}
                onClick={startUpload}
              >
                Upload & Queue Extraction
              </button>
            </div>
          )}
        </div>

        {/* Upload Progress Bar */}
        {uploading && uploadProgress && (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span>Uploading chunked video directly to storage...</span>
              <span>{uploadProgress.percentage}% ({formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.totalBytes)})</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-600 transition-all duration-200"
                style={{ width: `${uploadProgress.percentage}%` }}
              ></div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={togglePause}
              >
                {uploadPaused ? "Resume Upload" : "Pause Upload"}
              </button>
              <button
                type="button"
                className={BUTTON_DANGER}
                onClick={cancelUpload}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Video Jobs List */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Walkthrough Processing Jobs ({jobs.length})</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {jobs.map((job) => {
              const isSelected = selectedJobId === job.id
              const stateTone =
                job.state === "ready_for_review"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : job.state === "failed"
                  ? "bg-red-100 text-red-900 border-red-300"
                  : job.state === "processing"
                  ? "bg-blue-100 text-blue-900 border-blue-300"
                  : "bg-slate-100 text-slate-800 border-slate-300"

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`flex flex-col text-left rounded-xl border p-3 transition-all ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/30 ring-1 ring-emerald-600"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="font-mono text-xs font-bold text-slate-900 truncate">
                      {job.id}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${stateTone}`}>
                      {job.state.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between w-full">
                    <span>{job.observedBytes ? formatBytes(job.observedBytes) : formatBytes(job.declaredBytes)}</span>
                    <span>{job.durationMs ? formatMmSs(job.durationMs) : "--:--"}</span>
                  </div>
                  {job.failureCode && (
                    <span className="mt-1 text-[10px] font-medium text-red-700 truncate">
                      Reason: {job.failureCode}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Job Review & Genuine Frames Gallery */}
      {activeJobDetail && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">Job: {activeJobDetail.id}</span>
                {loadingDetail && (
                  <span className="text-[11px] text-blue-600 font-medium animate-pulse">
                    Loading frame details...
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  ({activeJobDetail.frames?.length ?? 0} genuine frames extracted)
                </span>
              </div>
              {activeJobDetail.sha256 && (
                <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate max-w-md">
                  Original SHA-256: {activeJobDetail.sha256}
                </p>
              )}
            </div>

            {activeJobDetail.contactSheetUrl && (
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={() => setShowContactSheet(true)}
              >
                View Contact Sheet
              </button>
            )}
          </div>

          {/* Pending or Processing Notice */}
          {activeJobDetail.state === "queued" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <p className="font-semibold">Queued for server extraction worker</p>
                <p>The upload is confirmed and is awaiting extraction by the worker process.</p>
              </div>
              <button
                type="button"
                className={BUTTON_PRIMARY}
                onClick={triggerWorker}
                disabled={workerBusy}
                data-testid="run-media-worker-btn"
              >
                {workerBusy ? "Extracting Frames..." : "Run Media Worker"}
              </button>
            </div>
          )}

          {activeJobDetail.state === "processing" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex items-center gap-3">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></span>
              <span>Worker is currently extracting frames losslessly via FFmpeg...</span>
            </div>
          )}

          {/* Frame Gallery (Responsive Grid for Android & Desktop) */}
          {activeJobDetail.state === "ready_for_review" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Select a genuine extracted frame to inspect or attach to a checklist item:</span>
                <span className="font-medium text-emerald-800">Unenhanced Lossless PNGs</span>
              </div>

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3" data-testid="frames-gallery">
                {activeJobDetail.frames?.map((frame) => (
                  <div
                    key={frame.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs hover:border-emerald-500 transition-all"
                  >
                    {/* Thumbnail Image */}
                    <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                      {frame.thumbnailUrl ? (
                        <img
                          src={frame.thumbnailUrl}
                          alt={`Frame ${frame.sequenceNo} at ${formatMmSs(frame.sourceTimeMs)}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          Thumbnail unavailable
                        </div>
                      )}
                      <span className="absolute top-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white tracking-wider">
                        F{String(frame.sequenceNo).padStart(2, "0")} · {formatMmSs(frame.sourceTimeMs)}
                      </span>
                      <span className="absolute top-1 right-1 rounded bg-slate-900/70 backdrop-blur-xs px-1.5 py-0.5 text-[8px] font-semibold text-slate-200 uppercase tracking-wide">
                        Still
                      </span>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 space-y-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{frame.width}×{frame.height}</span>
                          <span title={frame.sha256} className="truncate max-w-[80px]">
                            {frame.sha256.slice(0, 8)}...
                          </span>
                        </div>
                        {frame.isReviewedEvidence && (
                          <span className="inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                            ✓ Reviewed Evidence
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setInspectedFrame(frame)}
                          className="inline-flex items-center justify-center min-h-[32px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachingFrame(frame)
                            setAttachObservation(`Visual evidence from frame ${frame.sequenceNo} at ${formatMmSs(frame.sourceTimeMs)}.`)
                          }}
                          className="inline-flex items-center justify-center min-h-[32px] rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                        >
                          Attach
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspect Frame Modal */}
      {inspectedFrame && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Frame F{String(inspectedFrame.sequenceNo).padStart(2, "0")} · Source Time: {formatMmSs(inspectedFrame.sourceTimeMs)}
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  SHA-256: {inspectedFrame.sha256}
                </p>
              </div>
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={() => setInspectedFrame(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-slate-950 p-2 flex items-center justify-center">
              {inspectedFrame.originalFrameUrl ? (
                <img
                  src={inspectedFrame.originalFrameUrl}
                  alt={`Full resolution frame ${inspectedFrame.sequenceNo}`}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="p-8 text-center text-sm text-slate-400">
                  Original PNG preview URL unavailable.
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="text-[11px] text-slate-500">Pristine unenhanced lossless PNG · Zero AI modifications · Audio stripped</span>
              <button
                type="button"
                className={`${BUTTON_PRIMARY} justify-center w-full sm:w-auto`}
                onClick={() => {
                  const frame = inspectedFrame
                  setInspectedFrame(null)
                  setAttachingFrame(frame)
                  setAttachObservation(`Visual evidence from frame ${frame.sequenceNo} at ${formatMmSs(frame.sourceTimeMs)}.`)
                }}
              >
                Attach to Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Sheet Modal */}
      {showContactSheet && activeJobDetail?.contactSheetUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Tiled Contact Sheet [DERIVATIVE]
                </h4>
                <p className="text-xs text-slate-500">
                  Stitched derivative with frame index and source PTS timestamps for rapid visual overview.
                </p>
              </div>
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={() => setShowContactSheet(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-950 p-2 flex items-center justify-center">
              <img
                src={activeJobDetail.contactSheetUrl}
                alt="Contact sheet derivative"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Attach Frame Modal */}
      {attachingFrame && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <form
            onSubmit={submitFrameAttachment}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="border-b border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">
                Attach Frame F{String(attachingFrame.sequenceNo).padStart(2, "0")} ({formatMmSs(attachingFrame.sourceTimeMs)}) to Checklist
              </h4>
              <p className="text-xs text-slate-500">
                Creates an unreviewed suggestion for operator review. Does not alter deal calculations until accepted.
              </p>
            </div>

            <div className="space-y-4 p-4 text-xs">
              {/* Checklist Item Picker */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Target Inspection Check
                </label>
                <select
                  value={attachCheckId}
                  onChange={(e) => setAttachCheckId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium text-slate-800"
                >
                  {checks.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} {c.title ? `- ${c.title}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Working draft wording pending final owner approval.
                </p>
              </div>

              {/* Status Picker */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Initial Condition Classification
                </label>
                <select
                  value={attachStatus}
                  onChange={(e) => setAttachStatus(e.target.value as "OBSERVED" | "CONCERN" | "SPECIALIST_REVIEW")}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium text-slate-800"
                >
                  <option value="OBSERVED">OBSERVED (Visual confirmation / normal condition)</option>
                  <option value="CONCERN">CONCERN (Requires refurbishment or repair)</option>
                  <option value="SPECIALIST_REVIEW">SPECIALIST REVIEW (Hidden structural or specialist inspection)</option>
                </select>
              </div>

              {/* Optional Room Label */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Room or Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Front Elevation, Roof, Kitchen"
                  value={attachRoom}
                  onChange={(e) => setAttachRoom(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                />
              </div>

              {/* Observation Notes */}
              <div>
                <label className="block font-semibold text-slate-700">
                  Operator Observation / Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={attachObservation}
                  onChange={(e) => setAttachObservation(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                />
              </div>

              {/* Nonauthoritative Advisory Warning */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 leading-relaxed">
                <strong>Advisory Suggestion Only:</strong> Attaching this frame places a nonauthoritative proposal on the selected check. It does not establish a defect, structural condition, measurement, or repair quote until you explicitly review and accept it in the checklist.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                className={`${BUTTON_SECONDARY} order-2 sm:order-1 justify-center`}
                onClick={() => setAttachingFrame(null)}
                disabled={attachingBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${BUTTON_PRIMARY} order-1 sm:order-2 justify-center`}
                disabled={attachingBusy}
              >
                {attachingBusy ? "Attaching..." : "Attach as Suggestion"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
