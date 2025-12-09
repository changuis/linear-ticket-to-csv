import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"
const CSV_HEADER = "項目,ユーザーロール（管理者かユーザー）,操作手順,期待結果"

type RequestBody = {
  issueId?: string
  issueIds?: string | string[]
  description?: string
  model?: string
  cases?: number
  linearApiKey?: string
  openaiApiKey?: string
}

type LinearIssue = {
  identifier?: string | null
  title?: string | null
  description?: string | null
}

function normalizeIssueInput(input: string): string {
  const trimmed = input.trim()
  // If the user pasted a Linear URL, try to pull the identifier (e.g., ENG-123).
  const match = trimmed.match(/([A-Z]+-\d+)/)
  if (match?.[1]) return match[1]
  return trimmed
}

function parseIssueInputs(input?: string | string[]): string[] {
  const values = Array.isArray(input) ? input : [input ?? ""]
  const results = new Set<string>()

  for (const value of values) {
    if (!value) continue
    const tokens = value
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean)

    for (const token of tokens) {
      const matches = token.match(/[A-Za-z]+-\d+/g)
      if (matches?.length) {
        matches.forEach((id) => results.add(normalizeIssueInput(id)))
        continue
      }
      results.add(normalizeIssueInput(token))
    }
  }

  return Array.from(results)
}

function splitIdentifier(identifier: string): { teamKey: string; number: number } | null {
  const match = identifier.match(/^([A-Za-z]+)-(\d+)$/)
  if (!match) return null
  return { teamKey: match[1].toUpperCase(), number: Number(match[2]) }
}

async function fetchIssueById(issueId: string, apiKey: string) {
  const query = `
    query IssueById($id: String!) {
      issue(id: $id) {
        identifier
        title
        description
      }
    }
  `
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { id: issueId } }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `Linear request failed with status ${response.status}${
        errorText ? `: ${errorText.slice(0, 200)}` : ""
      }`,
    )
  }

  const payload = (await response.json()) as { data?: { issue?: LinearIssue | null }; errors?: unknown }
  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors))
  }
  return payload.data?.issue ?? null
}

async function fetchIssueByTeamAndNumber(teamKey: string, number: number, apiKey: string) {
  // First resolve team ID by key, then fetch issue by number + team ID.
  const teamQuery = `
    query TeamByKey($teamKey: String!) {
      teams(filter: { key: { eq: $teamKey } }, first: 1) {
        nodes {
          id
        }
      }
    }
  `
  const teamResponse = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: teamQuery, variables: { teamKey } }),
  })

  if (!teamResponse.ok) {
    const errorText = await teamResponse.text().catch(() => "")
    throw new Error(
      `Linear team lookup failed with status ${teamResponse.status}${
        errorText ? `: ${errorText.slice(0, 200)}` : ""
      }`,
    )
  }

  const teamPayload = (await teamResponse.json()) as {
    data?: { teams?: { nodes?: { id: string }[] | null } | null }
    errors?: unknown
  }
  if (teamPayload.errors) {
    throw new Error(JSON.stringify(teamPayload.errors))
  }
  const teamId = teamPayload.data?.teams?.nodes?.[0]?.id
  if (!teamId) return null

  const issueQuery = `
    query IssueByNumber($teamId: String!, $number: Int!) {
      issues(
        filter: { number: { eq: $number }, team: { id: { eq: $teamId } } }
        first: 1
      ) {
        nodes {
          identifier
          title
          description
        }
      }
    }
  `
  const issueResponse = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: issueQuery, variables: { teamId, number } }),
  })

  if (!issueResponse.ok) {
    const errorText = await issueResponse.text().catch(() => "")
    throw new Error(
      `Linear issue lookup failed with status ${issueResponse.status}${
        errorText ? `: ${errorText.slice(0, 200)}` : ""
      }`,
    )
  }

  const issuePayload = (await issueResponse.json()) as {
    data?: { issues?: { nodes?: LinearIssue[] | null } | null }
    errors?: unknown
  }
  if (issuePayload.errors) {
    throw new Error(JSON.stringify(issuePayload.errors))
  }
  return issuePayload.data?.issues?.nodes?.[0] ?? null
}

function buildPrompt(description: string, cases?: number, issueIds?: string[]) {
  const caseHint = cases ? `Generate exactly ${cases} test cases.` : "Generate a concise set of the most important test cases."
  const ticketsHint = issueIds?.length
    ? `Descriptions are combined from ${issueIds.length} Linear ticket${issueIds.length > 1 ? "s" : ""}: ${issueIds.join(", ")}. Cover scenarios across all of them.`
    : "Use the Linear ticket description below to produce test cases in Japanese."

  return `
${ticketsHint}
${caseHint}

Output format:
- CSV rows only (no header), columns in this order:
  項目, ユーザーロール（管理者かユーザー）, 操作手順, 期待結果
- Role must be one of: 管理者, ユーザー, 全員.
- Keep each step and expected result specific and actionable.
- Do not add numbering, bullets, or extra commentary.
- Escape commas and quotes per CSV rules if needed.

Description:
${description.trim()}
`.trim()
}

function cleanModelOutput(raw: string): string {
  let content = raw.trim()
  if (content.startsWith("```")) {
    content = content
      .split("\n")
      .filter((line) => !line.trim().startsWith("```"))
      .join("\n")
      .trim()
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines[0]?.replace(/\s/g, "").startsWith("項目,")) {
    lines.shift()
  }

  return lines.join("\n")
}

async function fetchLinearDescription(issueId: string, apiKey: string): Promise<string> {
  // 1) Try raw ID (UUID).
  const byId = await fetchIssueById(issueId, apiKey).catch(() => null)
  if (byId) {
    const heading = `${byId.identifier ?? ""} ${byId.title ?? ""}`.trim()
    const parts = [heading].filter(Boolean)
    if (byId.description) parts.push(byId.description)
    return parts.join("\n\n")
  }

  // 2) Try identifier in form TEAM-123 (needs team key + number).
  const parsed = splitIdentifier(issueId)
  if (parsed) {
    const byNumber = await fetchIssueByTeamAndNumber(parsed.teamKey, parsed.number, apiKey).catch(() => null)
    if (byNumber) {
      const heading = `${byNumber.identifier ?? ""} ${byNumber.title ?? ""}`.trim()
      const parts = [heading].filter(Boolean)
      if (byNumber.description) parts.push(byNumber.description)
      return parts.join("\n\n")
    }
  }

  throw new Error("Issue not found. Check the identifier (e.g., ENG-123) or the issue ID from the URL.")
}

export async function POST(request: NextRequest) {
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const model = body.model?.trim() || "gpt-4o-mini"
  const cases = body.cases && Number.isFinite(body.cases) ? body.cases : undefined
  const openaiKey = body.openaiApiKey || process.env.OPENAI_API_KEY
  const linearKey = body.linearApiKey || process.env.LINEAR_API_KEY
  const issueInputs = parseIssueInputs(body.issueIds ?? body.issueId)

  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is required (env or request payload)." }, { status: 400 })
  }

  let description = body.description?.trim()
  if (!description) {
    if (issueInputs.length === 0) {
      return NextResponse.json({ error: "issueId(s) or description is required." }, { status: 400 })
    }
    if (!linearKey) {
      return NextResponse.json({ error: "LINEAR_API_KEY is required to fetch from Linear." }, { status: 400 })
    }

    const fetchedDescriptions: string[] = []
    const failures: { id: string; message: string }[] = []

    for (const issueId of issueInputs) {
      try {
        const normalizedIssueId = normalizeIssueInput(issueId)
        const desc = await fetchLinearDescription(normalizedIssueId, linearKey)
        fetchedDescriptions.push(desc)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push({ id: issueId, message })
      }
    }

    if (fetchedDescriptions.length === 0) {
      const firstFailure = failures[0]?.message ?? "Unknown error."
      return NextResponse.json(
        { error: `Failed to fetch Linear description: ${firstFailure}` },
        { status: 400 },
      )
    }

    if (failures.length > 0) {
      const failedIds = failures.map((f) => f.id).join(", ")
      const detail = failures[0]?.message ?? "Unknown error."
      return NextResponse.json(
        { error: `Failed to fetch Linear description for: ${failedIds}. ${detail}` },
        { status: 400 },
      )
    }

    description = fetchedDescriptions.join("\n\n---\n\n")
  }

  try {
    const client = new OpenAI({ apiKey: openaiKey })
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a QA specialist who writes succinct, high-quality test cases in Japanese. Always follow the requested CSV format.",
        },
        { role: "user", content: buildPrompt(description!, cases, issueInputs.length ? issueInputs : undefined) },
      ],
      temperature: 0.3,
    })

    const rawContent = completion.choices[0]?.message?.content
    if (!rawContent) {
      return NextResponse.json({ error: "No content returned from model." }, { status: 500 })
    }

    const csv = cleanModelOutput(rawContent)
    return NextResponse.json({ header: CSV_HEADER, csv })
  } catch (error) {
    return NextResponse.json({ error: `Failed to generate test cases: ${String(error)}` }, { status: 500 })
  }
}
