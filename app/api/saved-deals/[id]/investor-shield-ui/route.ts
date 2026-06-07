import { NextResponse } from "next/server"
import { loadInvestorShieldUiModelForDeal } from "@/lib/investor-shield/load-investor-shield-ui-model"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

const SAFE_ERROR = "Investor Shield status could not be loaded. Pipeline rules remain unchanged."

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: SAFE_ERROR }, { status: 400 })
    }

    const model = await loadInvestorShieldUiModelForDeal(id)

    return NextResponse.json({ success: true, model }, { status: 200 })
  } catch {
    return NextResponse.json({ success: false, error: SAFE_ERROR }, { status: 500 })
  }
}
