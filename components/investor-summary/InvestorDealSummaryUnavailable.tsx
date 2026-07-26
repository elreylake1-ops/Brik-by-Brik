export default function InvestorDealSummaryUnavailable() {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-2xl">
        <section
          aria-labelledby="investor-deal-summary-unavailable-heading"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm"
        >
          <h1
            id="investor-deal-summary-unavailable-heading"
            className="text-2xl font-bold text-amber-950"
          >
            Investor and deal summary temporarily unavailable
          </h1>
          <p className="mt-3 text-sm text-amber-950">
            The investor and deal summary could not be prepared from the current saved-deal data.
          </p>
          <p className="mt-3 text-sm text-amber-950">
            Try again after the underlying data service is available.
          </p>
        </section>
      </div>
    </main>
  )
}
