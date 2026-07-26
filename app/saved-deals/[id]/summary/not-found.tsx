export default function InvestorDealSummaryNotFound() {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <div className="mx-auto max-w-2xl">
        <section
          aria-labelledby="investor-deal-summary-not-found-heading"
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h1
            id="investor-deal-summary-not-found-heading"
            className="text-2xl font-bold text-gray-950"
          >
            Investor and deal summary not found
          </h1>
          <p className="mt-3 text-sm text-gray-700">
            The requested saved-deal summary could not be found.
          </p>
          <p className="mt-3 text-sm text-gray-700">No summary has been generated.</p>
        </section>
      </div>
    </main>
  )
}
