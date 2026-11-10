import test from "node:test";
import assert from "node:assert/strict";
import { rankReplacements, type MatchNeed, type Player } from "./readiness.ts";

const need: MatchNeed = { position: "Midfielder", minSkill: 3, maxBudget: 500, maxDistanceKm: 10, sport: "Football" };
const candidate = (overrides: Partial<Player> = {}): Player => ({ id: "a", name: "A Player", position: "Midfielder", skill: 4, availability: "available", eligible: true, budget: 400, distanceKm: 2, reliability: 90, sport: "Football", ...overrides });

test("returns no candidates when the bench is empty", () => assert.deepEqual(rankReplacements([], need), []));
test("hard filters unavailable, unknown, ineligible, wrong sport, and over-budget players", () => {
  const excluded = [candidate({id:"u",availability:"unavailable"}), candidate({id:"x",availability:"unknown"}), candidate({id:"e",eligible:false}), candidate({id:"s",sport:"Basketball"}), candidate({id:"b",budget:501})];
  assert.deepEqual(rankReplacements(excluded, need), []);
});
test("ranks eligible candidates and returns component evidence separately from confidence", () => {
  const ranked = rankReplacements([candidate({id:"low",skill:2,reliability:50}), candidate({id:"high",skill:5,reliability:95})], need);
  assert.equal(ranked[0].id, "high");
  assert.equal(ranked[0].components.skill, 100);
  assert.equal(ranked[0].confidence, 100);
  assert.ok(ranked[0].score <= 100);
});
test("missing evidence lowers confidence and never fabricates a value", () => {
  const [ranked] = rankReplacements([candidate({distanceKm:null,reliability:null})], need);
  assert.equal(ranked.confidence, 60);
  assert.equal(ranked.components.distance, 0);
  assert.ok(ranked.reasons.some(reason => reason.includes("not recorded")));
});
test("breaks equal scores by player name for stable output", () => {
  const ranked = rankReplacements([candidate({id:"z",name:"Zed"}), candidate({id:"a",name:"Ava"})], need);
  assert.equal(ranked[0].name, "Ava");
});
