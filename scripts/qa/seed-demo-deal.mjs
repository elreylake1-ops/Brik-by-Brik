import pg from "pg"
const { Client } = pg

const c = new Client({
  connectionString: "postgresql://brik_qa:577c65b75921ef836d117fd1efb05715008a2485d6ddd423@127.0.0.1:54339/brik_viewing_qa_local",
})

async function run() {
  await c.connect()
  console.log("Connected to local QA postgres.")

  const dealId = "deal-17408-blue-jay"
  const address = "17408 Blue Jay Way, Leeds LS1 4AB"
  const purchasePrice = 450000
  const gdvRealistic = 750000
  const refurbCost = 50000

  const res = await c.query(
    `INSERT INTO brik_by_brik_engine.saved_deals (
      id, address, purchase_price, gdv_realistic, refurb_cost,
      classification, governance_state, capital_protection_state, pipeline_state,
      engine_result_json, risk_summary_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      address = EXCLUDED.address,
      purchase_price = EXCLUDED.purchase_price,
      gdv_realistic = EXCLUDED.gdv_realistic,
      refurb_cost = EXCLUDED.refurb_cost
    RETURNING id, address;`,
    [
      dealId,
      address,
      purchasePrice,
      gdvRealistic,
      refurbCost,
      "GO",
      "APPROVED",
      "ADEQUATE",
      "VIEWING_SCHEDULED",
      JSON.stringify({ marker: "task12c-browser-demo", gdv: gdvRealistic, purchasePrice }),
      JSON.stringify({ summary: "Demonstration property for real video walkthrough review" }),
    ]
  )

  console.log("Seeded deal:", res.rows[0])
  await c.end()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
