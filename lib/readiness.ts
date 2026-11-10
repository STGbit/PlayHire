export type Player = {
  id: string; name: string; position: string; skill: number; availability: "available" | "unavailable" | "unknown";
  eligible: boolean; budget: number | null; distanceKm: number | null; reliability: number | null; sport: string;
};
export type MatchNeed = { position: string; minSkill: number; maxBudget: number; maxDistanceKm: number; distanceLimitKm?: number | null; sport: string };
export type RankedPlayer = Player & { score: number; confidence: number; components: Record<string, number>; reasons: string[] };

const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function rankReplacements(players: Player[], need: MatchNeed): RankedPlayer[] {
  return players.filter(p => p.availability === "available" && p.eligible && p.sport === need.sport && (need.position === "Any" || p.position === need.position || p.position === "Utility") && p.skill >= need.minSkill && p.budget !== null && p.budget <= need.maxBudget && (need.distanceLimitKm == null || (p.distanceKm !== null && p.distanceKm <= need.distanceLimitKm)))
    .map(p => {
      const position = need.position === "Any" || p.position === need.position ? 100 : p.position === "Utility" ? 75 : 0;
      const skill = clamp(p.skill * 20);
      const reliability = p.reliability ?? 0;
      const distance = p.distanceKm === null ? 0 : clamp((1 - p.distanceKm / Math.max(need.maxDistanceKm * 2, 1)) * 100);
      const budget = p.budget === null ? 0 : clamp((1 - p.budget / Math.max(need.maxBudget, 1)) * 100);
      const components = { position, skill, reliability, distance, budget };
      const score = Math.round(position * .3 + skill * .25 + reliability * .2 + distance * .15 + budget * .1);
      const known = [p.position !== "", p.skill > 0, p.reliability !== null, p.distanceKm !== null, p.budget !== null];
      const reasons = [`${p.position} position match: ${position}%`, `Skill compatibility: ${skill}%`, `Reliability evidence: ${p.reliability === null ? "not recorded" : `${reliability}%`}`, `Travel distance: ${p.distanceKm === null ? "not recorded" : `${p.distanceKm} km`}`, `Budget: ₹${p.budget}`];
      return { ...p, score, confidence: Math.round(known.filter(Boolean).length / known.length * 100), components, reasons };
    }).sort((a,b) => b.score-a.score || a.name.localeCompare(b.name));
}
