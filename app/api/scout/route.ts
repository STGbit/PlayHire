import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isScoutCriteria, scoutPositions, type ScoutDefaults } from "@/lib/scout";

export const runtime = "nodejs";
const recentRequests = new Map<string, number[]>();

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    position: { type: "string", enum: scoutPositions },
    minSkill: { type: "integer", minimum: 1, maximum: 5 },
    maxBudget: { type: "integer", minimum: 0, maximum: 50000 },
    maxDistanceKm: {
      anyOf: [
        { type: "number", minimum: 0, maximum: 500 },
        { type: "null" },
      ],
    },
    nameQuery: { type: "string" },
  },
  required: ["position", "minSkill", "maxBudget", "maxDistanceKm", "nameQuery"],
} as const;

function validDefaults(value: unknown): value is ScoutDefaults {
  return isScoutCriteria(value);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI scouting is not configured yet. Add OPENAI_API_KEY to the server environment." }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !supabaseKey || !accessToken) {
    return NextResponse.json({ error: "Sign in to use AI scouting." }, { status: 401 });
  }

  const authClient = createClient(url, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  const { data: captainTeams, error: teamError } = await authClient.from("teams").select("id").eq("captain_id", user.id).limit(1);
  if (teamError || !captainTeams?.length) return NextResponse.json({ error: "AI scouting is available to captains with a team." }, { status: 403 });

  const now = Date.now();
  const recent = (recentRequests.get(user.id) || []).filter(timestamp => now - timestamp < 60_000);
  if (recent.length >= 12) return NextResponse.json({ error: "Please wait a minute before sending another scouting request." }, { status: 429 });
  recent.push(now);
  recentRequests.set(user.id, recent);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid scouting request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Send a valid scouting request." }, { status: 400 });
  }
  const input = body as { request?: unknown; defaults?: unknown };
  if (typeof input.request !== "string" || !input.request.trim() || input.request.length > 500 || !validDefaults(input.defaults)) {
    return NextResponse.json({ error: "Add a short request and valid current filters." }, { status: 400 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        model: process.env.OPENAI_SCOUT_MODEL || "gpt-4.1-mini",
        max_output_tokens: 250,
        input: [
          {
            role: "developer",
            content: "You convert a captain's short football replacement request into search filters. Do not rank or evaluate players, invent player data, or change the scoring rules. Use the supplied current filter as the default for anything the captain did not specify. Map a winger or striker to Forward, a centre back or fullback to Defender, and a goalkeeper to Goalkeeper. A distance phrase such as within 5 km becomes a maximum distance. Only put an exact player name in nameQuery when the user explicitly asks for that person; otherwise return an empty string. Return only the requested structured data.",
          },
          { role: "user", content: JSON.stringify({ request: input.request.trim(), currentFilters: input.defaults }) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "playhire_scout_filters",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI scouting could not interpret that request. Try a shorter description." }, { status: 502 });
    }

    const result = await response.json() as {
      output_text?: string;
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = result.output_text || result.output
      ?.filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .find(item => item.type === "output_text")?.text;
    if (!outputText) return NextResponse.json({ error: "AI returned no search filters. Try describing the position, skill, or budget." }, { status: 502 });
    const criteria: unknown = JSON.parse(outputText);
    if (!isScoutCriteria(criteria)) return NextResponse.json({ error: "AI returned invalid search filters. Please try again." }, { status: 502 });
    return NextResponse.json({ criteria });
  } catch {
    return NextResponse.json({ error: "AI scouting is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
