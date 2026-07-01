function SkeletonBlock({ label }: { label: string }) {
  return (
    <section
      aria-hidden="true"
      className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="h-4 w-40 rounded bg-gray-200" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-5/6 rounded bg-gray-100" />
      </div>
      <span className="sr-only">{label}</span>
    </section>
  )
}

export default function InvestorReviewLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="sr-only">Preparing investor review…</p>
        <SkeletonBlock label="Header loading" />
        <SkeletonBlock label="Property and deal overview loading" />
        <SkeletonBlock label="Investment summary loading" />
        <SkeletonBlock label="Decision and capital-protection status loading" />
        <SkeletonBlock label="Required hard gates loading" />
        <SkeletonBlock label="Evidence Lite notes loading" />
        <SkeletonBlock label="Footer loading" />
      </div>
    </main>
  )
}
