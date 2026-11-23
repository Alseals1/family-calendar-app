# Family Calendar

A private family calendar web app. Two adults each keep a personal calendar, choose which events the other can see, and share a family calendar for the household and the children's activities.

**What to build is defined in [docs/prd.md](docs/prd.md); how, in [docs/plan.md](docs/plan.md); the work order, in [docs/tasks.md](docs/tasks.md). Read the PRD before you plan or build anything.** If an issue asks for something the PRD lists as out of scope, contradicts the PRD, or depends on a decision still marked Open or Proposed in PRD section 11, stop and ask a question instead of building it.

Stack: Next.js (App Router, TypeScript strict), Tailwind CSS, shadcn/ui, Lucide, Supabase (Postgres, Auth, Storage, Row Level Security). Mobile first. Free tier only for Phase 1.

## Commands

> Created by task T01. Until then these do not exist.

```sh
npm run dev               # Next.js dev server
npm run build
npm run lint
npm run typecheck         # tsc --noEmit
npm test                  # Vitest unit + component tests
npm run test:db           # pgTAP via `supabase test db` (needs `npx supabase start`)
npm run test:integration  # supabase-js against local Supabase
npm run test:e2e          # Playwright, desktop + phone
```

**Before a PR, all of `lint`, `typecheck`, `test`, `test:db`, `test:integration` and `test:e2e` must pass.** Say so in the PR if one fails for a reason your change did not cause.

## Test-driven development (required)

1. Write the failing tests named in the task first and commit them on their own (`test: ...`).
2. Then write the code that makes them pass (`feat: ...` / `fix: ...`), then refactor with tests green.
3. Every user-facing change adds or extends a Playwright spec in `e2e/`, run at 1280×800 and 390×844.
4. In the PR description, list the test-first commit so the reviewer can see the tests failed before the code existed.
5. Every database change adds pgTAP tests in `supabase/tests/`. Every RLS policy has a test that proves who **cannot** read or write, not only who can.

## Conventions

- Routes live in `src/app/`. Components in `src/components/`, logic in `src/lib/` (pure functions, unit-tested next to the file: `foo.ts` + `foo.test.ts`).
- No `any` without a comment that says why. Keep components small; no single giant component.
- Validate with the shared zod schemas on the client **and** in the server action. The database constraints are the third line.
- Add a dependency only when the plan lists it or the task's plan was approved with it.
- Do not hard-code colors, spacing or repeated strings: use the shared palette and copy constants.
- Never use browser `alert` / `confirm` / `prompt`; use in-app dialogs.

## Supabase

- Clients: `src/lib/supabase/{client,server,middleware}.ts`. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (see `.env.example`).
- Use only a **local** Supabase (`npx supabase start`, needs Docker) with made-up data. Never point the app, a test or an agent at a hosted project. Never run `supabase link`, `supabase db push`, `supabase functions deploy` or any command against a remote.
- Database changes are migration files in `supabase/migrations/`, never manual edits. Every table has RLS on, with a policy for each way the app reads or writes it.
- The app never uses the service-role key. Never put a service-role key, secret or real personal data in code, tests, PRs or comments.
- A migration, an auth change, a permission change or a new dependency is a gate item: say so in the plan.

## Product rules (from the PRD; the PRD wins if they differ)

- **Private events are visible only to their creator.** Other adults get no row, no title, no time, no busy block and no assignments. Enforced by RLS, never only in the UI.
- Shared = visible to the other adult(s) in the family. Family = on the family calendar for every adult, and any adult can edit or delete it.
- Invites are copyable links; the app sends no invite email. Auth emails go through Supabase (Resend SMTP in production, Mailpit locally).
- Children are profiles without logins.
- Phase 1: max 2 adults per family, one family per user, no recurrence, no external calendar sync, no AI features, no push/email reminders.
- Times are stored in UTC and shown in the viewer's local time zone; all-day events never shift a day.

## Working with G.O.A.T. AI

All Phase 1 issues in this repo are worked by G.O.A.T. AI **on autopilot**: agents plan, build and review, and the coordinator approves gates and merges into `dev` once CI is green. No person reads a plan before it is built, so the PRD, the plan and this file are the rules. When you are working a G.O.A.T. issue, the G.O.A.T. protocol (`python3 ~/.goat-ai/goat.py guide`) wins over anything here where they differ.

- **Branches:** `dev` is the default and integration branch. Cut `goat/<issue number>-<slug>` from `dev` in the issue's worktree; PRs target `dev`. `main` is promoted from `dev` by a person only.
- **PR bodies** contain `Refs #<issue number>`, never `Closes`, `Fixes` or `Resolves`: the coordinator closes the issue after QA.
- **Roadmap:** the work order is [docs/tasks.md](docs/tasks.md). Each issue maps to one task (T01–T20) and names it in its title.
- **Depends on:** check that every issue on the issue's "Depends on" line is closed. If one is not, ask on the issue instead of starting.
- **Decisions:** PRD section 11 is the decision log. Build only on decisions marked **Decided**. Anything the docs leave open (a product rule, an account, money, a licence, a design call) is a question for the owner, not something to guess.
- **Local services:** all agents share one local Supabase stack on this machine. Run `npx supabase start` if it is not running; never stop it, and never change its ports or project id.
- **Never deploy:** no `vercel` commands, no hosted Supabase changes, no secrets. A person does T20.
