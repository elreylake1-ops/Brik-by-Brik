import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldTaskRecommendation from "@/components/InvestorShieldTaskRecommendation"
import InvestorShieldTaskRecommendationList from "@/components/InvestorShieldTaskRecommendationList"
import { taskRecommendationFixture } from "./fixtures/investor-shield-ui-fixtures"

describe("InvestorShieldTaskRecommendation", () => {
  it("renders read-only task recommendation details", () => {
    const task = taskRecommendationFixture.taskRecommendations[0]
    const html = renderToStaticMarkup(<InvestorShieldTaskRecommendation task={task} />)

    expect(html).toContain("Review lender criteria")
    expect(html).toContain("Recommended action")
    expect(html).toContain("Linked due diligence gate: LENDER_CRITERIA")
    expect(html).toContain("Status: open")
    expect(html).toContain("Duplicate-safe: Yes")
    expect(html).toContain("Duplicate-safe task recommendation")
    expect(html).toContain("This recommendation does not satisfy the gate by itself.")
    expect(html).toContain("Action type: review_lender_criteria")
    expect(html).not.toContain("Create Task")
    expect(html).not.toContain("Complete Task")
    expect(html).not.toContain("Approve")
  })
})

describe("InvestorShieldTaskRecommendationList", () => {
  it("renders task recommendations as a read-only list", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldTaskRecommendationList tasks={taskRecommendationFixture.taskRecommendations} />
    )

    expect(html).toContain("Review lender criteria")
    expect(html).toContain("Linked due diligence gate: LENDER_CRITERIA")
    expect(html).toContain("This recommendation does not satisfy the gate by itself.")
    expect(html).not.toContain("Resolve Task")
  })
})
