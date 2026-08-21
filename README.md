# Win Matrix

Daily wins tracker with a shared, live scoreboard. The Google Sheets Ops Matrix, rebuilt as an app: record a state per op per day, keep every score at or above 85, share your scores so people can cheer each other on.

- Spec: `docs/brief.md` (scoring, decisions) · `docs/decisions.md` (design rulings) · `docs/grill-log.md` (build rulings)
- Rules for working in this repo: `CLAUDE.md`
- Design reference (visual contract only): `docs/design/`

## Stack

Vite + TypeScript, no framework. Supabase (Postgres, Auth, Realtime broadcast) on the free plan. GitHub Pages.

```
src/domain/    pure scoring engine + model (the one place product rules live)
src/data/      every Supabase call (the one door)
src/ui/        render helper, theme, nav, wall layout
src/screens/   one file per page: login, matrix, scoreboard, display
supabase/      schema, RLS, two RPCs (claim_share, display_snapshot)
scripts/       seed.ts: generated sample data for testing
```

## Run locally

```
cp .env.example .env          # fill in the Supabase URL + publishable key
npm install
npm run dev                   # http://localhost:5173/win-matrix-cc-v02/
npm run check                 # tests + typecheck + build: the one gate
```

## Supabase

```
npx supabase link --project-ref <ref>
npx supabase db push          # applies supabase/migrations
npx supabase config push      # auth settings (email+password, confirmations off, site URL)
npm run types                 # regenerate src/data/database.types.ts from the live schema
```

Seed three test users with 60 days of history (needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment; never commit them):

```
npm run seed                  # create
npm run seed -- --clean       # remove
```

## Deploy

Push to `main`. `.github/workflows/deploy.yml` runs `npm run check` and publishes `dist/` to GitHub Pages. The two public Vite values come from repository **variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## How the pieces fit

- Scores are computed client-side by `src/domain/scoring.ts`. The owner's client writes a derived `daily_scores` row per day through one function, `recomputeRange`; shared boards read those rows. See the grill log, Q32.
- Sharing is by link: `scoreboard.html?claim=<token>`. A signed-in recipient claims it and a grant binds to them at the link's depth (summary or full grid). Q31.
- The wall display opens by `display.html?key=<token>`, no sign-in. It calls one read-only RPC and listens on a broadcast channel per person shown. Q34.
