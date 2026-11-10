export const scoutPositions = ["Any", "Goalkeeper", "Defender", "Midfielder", "Forward", "Utility"] as const;

export type ScoutPosition = (typeof scoutPositions)[number];

export type ScoutDefaults = {
  position: ScoutPosition;
  minSkill: number;
  maxBudget: number;
  maxDistanceKm: number | null;
  nameQuery: string;
};

export type ScoutCriteria = ScoutDefaults;

export function isScoutCriteria(value: unknown): value is ScoutCriteria {
  if (!value || typeof value !== "object") return false;
  const criteria = value as Record<string, unknown>;
  return scoutPositions.includes(criteria.position as ScoutPosition)
    && Number.isInteger(criteria.minSkill) && Number(criteria.minSkill) >= 1 && Number(criteria.minSkill) <= 5
    && Number.isInteger(criteria.maxBudget) && Number(criteria.maxBudget) >= 0 && Number(criteria.maxBudget) <= 50000
    && (criteria.maxDistanceKm === null || (typeof criteria.maxDistanceKm === "number" && Number.isFinite(criteria.maxDistanceKm) && criteria.maxDistanceKm >= 0 && criteria.maxDistanceKm <= 500))
    && typeof criteria.nameQuery === "string" && criteria.nameQuery.length <= 80;
}
