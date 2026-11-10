import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isScoutCriteria, scoutPositions, type ScoutDefaults } from "@/lib/scout";

export const runtime = "nodejs";
const recentRequests = new Map<string, number[]>();

const schema = {
  type: "object",
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI scouting is not configured yet. Add GEMINI_API_KEY to the server environment." }, { status: 503 });
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
    const preferredModel = process.env.GEMINI_MODEL || process.env.GEMINI_SCOUT_MODEL || "gemini-3.8-flash";
    const models = [...new Set([preferredModel, "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"] )];
    const payload = JSON.stringify({
      model: preferredModel,
      system_instruction: "You convert a captain's short football replacement request into search filters. Do not rank or evaluate players, invent player data, or change the scoring rules. Use the supplied current filter as the default for anything the captain did not specify. Map a winger or striker to Forward, a centre back or fullback to Defender, and a goalkeeper to Goalkeeper. A distance phrase such as within 5 km becomes a maximum distance. Only put an exact player name in nameQuery when the user explicitly asks for that person; otherwise return an empty string. Use null for maxDistanceKm when no distance limit is requested. Return only the requested structured data.",
      input: JSON.stringify({ request: input.request.trim(), currentFilters: input.defaults }),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema,
      },
      generation_config: { max_output_tokens: 250 },
    });
    let activeModel = preferredModel;
    let response: Response | undefined;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      for (const model of models) {
        activeModel = model;
        response = await requestGemini(model, apiKey, payload, controller.signal);
        if (response.status !== 503 && response.status !== 404) break;
      }
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response) return NextResponse.json({ error: "Gemini could not process the request. Please try again." }, { status: 502 });

    if (!response.ok) {
      const providerError = await response.json().catch(() => null) as {
        error?: { message?: string; status?: string };
      } | null;
      const detail = providerError?.error?.message;
      console.error("Gemini scouting request failed", response.status, providerError?.error?.status || "unknown status", detail || "No error details returned");
      return NextResponse.json({
        error: detail
          ? `Gemini API error (${response.status}, model ${activeModel}): ${detail}`
          : "Gemini could not process the request. Check the development server terminal for details.",
      }, { status: 502 });
    }

    const result = await response.json() as {
      output_text?: string;
      steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = result.output_text || result.steps
      ?.filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .filter(part => part.type === "text")
      .map(part => part.text || "")
      .join("");
    if (!outputText) return NextResponse.json({ error: "AI returned no search filters. Try describing the position, skill, or budget." }, { status: 502 });
    const criteria: unknown = JSON.parse(outputText);
    if (!isScoutCriteria(criteria)) return NextResponse.json({ error: "AI returned invalid search filters. Please try again." }, { status: 502 });
    return NextResponse.json({ criteria });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json({ error: "Gemini took too long to respond. Please try again." }, { status: 504 });
    }
    const cause = error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { code?: unknown } }).cause
      : undefined;
    const causeCode = typeof cause?.code === "string" ? cause.code : undefined;
    console.error("AI scouting request exception", error instanceof Error ? error.name : "UnknownError", error instanceof Error ? error.message : "Unknown failure", causeCode || "");
    const message = error instanceof SyntaxError
      ? "Gemini returned an unreadable response. Please retry."
      : error instanceof TypeError
        ? `Could not reach Gemini (${causeCode || "network error"}). Check your connection and retry.`
        : "AI scouting is temporarily unavailable. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function requestGemini(model: string, apiKey: string, payload: string, signal: AbortSignal) {
  const requestBody = JSON.parse(payload) as Record<string, unknown>;
  return fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({ ...requestBody, model }),
  });
}
