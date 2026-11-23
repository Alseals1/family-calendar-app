# Family Calendar

A private family calendar web app. Two adults each keep a personal calendar, choose which events the other can see, and share a family calendar for household events and the children's activities.

**Status:** Phase 1 MVP in development. Built by [G.O.A.T. AI](https://github.com/Alseals1/goat-ai) agents from this repo's issues.

- What we are building: [docs/prd.md](docs/prd.md)
- How: [docs/plan.md](docs/plan.md)
- Work order: [docs/tasks.md](docs/tasks.md)
- Rules for agents: [CLAUDE.md](CLAUDE.md)

Stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres, Auth, Row Level Security). Full install, test and deploy instructions arrive with task T19.

## Run it locally

You need Node 24 (`nvm use` reads `.nvmrc`).

```sh
npm install
cp .env.example .env.local        # then fill in the Supabase values (see "Local Supabase")
npx playwright install chromium   # once, for the end-to-end tests
npm run dev                       # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build, and serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (generates Next's route types first) |
| `npm test` | Vitest unit and component tests |
| `npm run test:db` | pgTAP database tests (`supabase test db`). Needs the local stack running |
| `npm run test:integration` | supabase-js integration tests against the local stack. Needs it running |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local database. Run after a migration |
| `npm run test:e2e` | Playwright at 1280×800 (desktop) and 390×844 (phone). Starts its own server on port 3100; set `E2E_PORT` to use another |

## Local Supabase

The app only ever talks to a local Supabase stack with made-up data. Never point it at a hosted project.

1. Install and start Docker.
2. Install the Supabase CLI 2.75 or newer: `brew install supabase/tap/supabase`.
3. Start the stack: `npx supabase start`. There is one stack, shared by every worktree (project id `family-calendar`). Never stop it and never change its ports or project id.
4. Copy `API_URL` and `ANON_KEY` from `npx supabase status -o env` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

| Service | URL |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Mailpit (auth emails) | http://127.0.0.1:54324 |

`npm run test:db` and `npm run test:integration` need the stack running. The integration tests read the URL and key from the environment, or from `supabase status` when those are not set.

If `npm run db:types` or `npm run test:db` reports `invalid keys` in `config.toml`, an older Supabase CLI is ahead of Homebrew's on your `PATH` (for example one in a parent folder's `node_modules/.bin`). Check with `npm exec -- supabase --version`.
