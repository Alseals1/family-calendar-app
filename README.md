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
cp .env.example .env.local        # the Supabase values arrive with task T02
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
| `npm run test:db` | pgTAP database tests. A placeholder until T02 adds Supabase |
| `npm run test:integration` | supabase-js integration tests. A placeholder until T02 |
| `npm run test:e2e` | Playwright at 1280×800 (desktop) and 390×844 (phone). Starts its own server on port 3100; set `E2E_PORT` to use another |
