"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isScoutCriteria, type ScoutCriteria, type ScoutDefaults } from "@/lib/scout";

type Props = {
  defaults: ScoutDefaults;
  onApply: (criteria: ScoutCriteria) => void;
};

export default function ScoutingAssistant({ defaults, onApply }: Props) {
  const [request, setRequest] = useState("");
  const [criteria, setCriteria] = useState<ScoutCriteria | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function interpret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request.trim()) return;
    if (!supabase) {
      setMessage("Connect Supabase and sign in to use AI scouting.");
      return;
    }

    setBusy(true);
    setMessage("");
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setMessage("Sign in again to use AI scouting.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/scout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ request: request.trim(), defaults }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json() as { criteria?: unknown; error?: string };
      if (!response.ok || !isScoutCriteria(result.criteria)) {
        setMessage(result.error || "Could not interpret that request. Try describing the position, skill, or budget.");
        setBusy(false);
        return;
      }

      setCriteria(result.criteria);
      onApply(result.criteria);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "TimeoutError"
        ? "The AI request timed out. Please try again."
        : "AI scouting is temporarily unavailable. Please try again.");
    }
    setBusy(false);
  }

  const summary = criteria && [
    criteria.position === "Any" ? "Any position" : criteria.position,
    `Skill ${criteria.minSkill}+`,
    `Budget up to ₹${criteria.maxBudget}`,
    criteria.maxDistanceKm === null ? null : `Within ${criteria.maxDistanceKm} km`,
    criteria.nameQuery ? `Name: ${criteria.nameQuery}` : null,
  ].filter(Boolean).join(" · ");

  return <section className="scout-ai-panel" aria-label="AI scouting assistant">
    <form className="scout-ai-form" onSubmit={interpret}>
      <label htmlFor="scout-request">Describe the player you need</label>
      <div className="scout-ai-controls">
        <input id="scout-request" value={request} maxLength={500} onChange={event => setRequest(event.target.value)} placeholder="For example: a midfielder with skill 3+, under ₹400, within 5 km" />
        <button className="btn btn-primary" type="submit" disabled={busy || !request.trim()}><Sparkles size={15}/>{busy ? "Reading request…" : "Interpret with AI"}</button>
      </div>
    </form>
    <p className="scout-ai-caption">AI reads only this request and your current filters; player records stay in PlayHire. Fixed rules rank the candidates.</p>
    {summary&&<div className="scout-ai-summary" role="status"><Sparkles size={14}/><span><strong>Filters applied:</strong> {summary}</span></div>}
    {message&&<p className="scout-ai-error" role="alert">{message}</p>}
  </section>;
}
