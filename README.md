# PlayHire

PlayHire is a football roster continuity MVP. It addresses the last minute problem of finding suitable cover when a player cannot attend a match.

Captains can create teams, manage roster entries, and schedule fixtures. Players can join with a team code and maintain a player profile. The scouting assistant accepts a natural language replacement request, uses AI to extract editable search criteria, then applies PlayHire's deterministic rules to filter and rank candidate profiles. AI does not invent player information, calculate fit scores, or make the final selection.

## AI role and current limits

- `app/api/scout/route.ts` sends only the captain's short request and current filter values to the OpenAI Responses API. Player records are not sent to the model.
- The model returns structured filters for position, minimum skill, budget, distance, and an explicitly requested player name. The app validates those filters and applies them locally through `lib/readiness.ts`.
- The rule based readiness score and its component reasons remain deterministic. The AI feature is unavailable until a server side `OPENAI_API_KEY` is configured.
- The recommendation pool in the dashboard is illustrative sample data. Real player availability, eligibility, travel distance, reliability, and fee data are not yet loaded into scouting. Do not present sample scores as real evaluations.
- Performance testing, cohort normalization, progress histories, and Talent Passports are future work, not current features.

## Local setup

1. Install Node.js 20.9 or newer and npm.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Never expose a service role key in browser code.
5. Add an OpenAI API key to the server only as `OPENAI_API_KEY`. Optionally set `OPENAI_SCOUT_MODEL`; the default is `gpt-4.1-mini`. Restart the dev server after changing environment values.
6. In Supabase SQL Editor, run migrations in order: `0001_initial.sql`, `0002_team_join_codes.sql`, `0003_team_roster.sql`, `0004_fix_join_team_ambiguity.sql`, `0005_leave_team.sql`, `0006_join_team_unambiguous_result.sql`, and `0007_joined_players_roster.sql`.
7. In Supabase Auth settings, enable email/password sign in and set the local site URL to `http://localhost:3000`.
8. Run `npm run dev` and open `http://localhost:3000`.

If `OPENAI_API_KEY` is missing, the rest of the app can still run; the scouting assistant displays a setup message instead of calling the model.

## Readiness ranking

Before scoring, the engine filters out candidates who are unavailable, ineligible, in the wrong sport, below the requested minimum skill, over the fee limit, or outside an explicit distance limit. It then scores position (30%), skill (25%), reliability evidence (20%), distance suitability (15%), and budget suitability (10%). Unknown availability does not qualify. Missing score evidence is not fabricated and reduces the separate data confidence value.

The AI can only extract user intent into these filters. It cannot alter the formula, turn an ineligible player into an eligible one, or choose a player for the captain.

## Deployment and submission checklist

- Deploy the Next.js app to a host such as Vercel and configure the same environment variables there. Keep `OPENAI_API_KEY` in server side deployment settings only.
- Configure the Supabase production site URL and allowed redirect URLs for the deployed domain.
- Test sign up, sign in, team creation, team join, roster add/remove, match creation, and AI scouting with non sample data before sharing the live URL.
- The repository does not include a deployed URL. A participant must deploy the project and submit the live link as required by the event.
- The event asks participants to develop and deploy independently. Confirm whether coding assistance is allowed, and make sure you understand, can explain, and can maintain every submitted part of the project.

## Project layout

- `app/` — Next.js pages, dashboard, and the server side AI route
- `app/api/scout/route.ts` — authenticated natural language filter extraction
- `app/dashboard/ScoutingAssistant.tsx` — AI scouting interface
- `lib/readiness.ts` — deterministic candidate eligibility and ranking
- `lib/scout.ts` — shared filter schema and validation
- `lib/supabase.ts` — browser safe Supabase client
- `supabase/migrations/` — PostgreSQL schema, join/leave RPCs, roster tables, and RLS policies
