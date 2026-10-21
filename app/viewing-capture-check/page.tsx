import { notFound } from "next/navigation"
import VideoCapture from "@/components/viewing-assessment/VideoCapture"

export const dynamic = "force-dynamic"

// Client-only capture check for testing a real video on a real device (for example an Android phone) BEFORE login
// and storage exist. It makes no API call, reads no data, and saves nothing, so it is not a way around the
// authenticated routes. In a deployed environment it is hidden (404) unless VIEWING_CAPTURE_CHECK_PAGE=true.
export default function ViewingCaptureCheckPage() {
  if (process.env.NODE_ENV === "production" && process.env.VIEWING_CAPTURE_CHECK_PAGE !== "true") notFound()
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">Video capture check</h1>
        <p className="text-sm text-gray-700">
          Choose or record a property video, then capture or sample frames to see whether this device decodes it. Nothing is saved.
        </p>
        <VideoCapture baseUrl="" dryRun diagnosticMode buildRef={process.env.VIEWING_CAPTURE_BUILD_REF} />
      </div>
    </main>
  )
}
