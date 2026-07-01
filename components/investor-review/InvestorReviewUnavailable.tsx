export default function InvestorReviewUnavailable() {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-2xl">
        <section
          aria-labelledby="investor-review-unavailable-heading"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm"
        >
          <h1 id="investor-review-unavailable-heading" className="text-2xl font-bold text-amber-950">
            Investor review temporarily unavailable
          </h1>
          <p className="mt-3 text-sm text-amber-950">
            The investor review could not be prepared from the current saved-deal data. No report
            has been generated.
          </p>
          <p className="mt-3 text-sm text-amber-950">
            Try again after the underlying data service is available.
          </p>
        </section>
      </div>
    </main>
  )
}
