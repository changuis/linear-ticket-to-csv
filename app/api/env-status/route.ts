import { NextResponse } from "next/server"

export async function GET() {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY)
  const hasLinear = Boolean(process.env.LINEAR_API_KEY)
  return NextResponse.json({ hasOpenAI, hasLinear })
}
