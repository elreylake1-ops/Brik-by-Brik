export default function InvestorReviewNotFound() {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-2xl">
        <section
          aria-labelledby="investor-review-not-found-heading"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h1 id="investor-review-not-found-heading" className="text-2xl font-bold text-gray-950">
            Investor review not found
          </h1>
          <p className="mt-3 text-sm text-gray-700">
            The requested saved deal could not be found, so an investor review could not be
            prepared.
          </p>
          <p className="mt-3 text-sm text-gray-700">No report has been generated.</p>
        </section>
      </div>
    </main>
  )
}
