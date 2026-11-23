# Family Calendar — Phase 1 Task List

Status: **v1.0 — approved 2026-11-23**. Every task, including T01, is built by G.O.A.T. AI on autopilot (D-01). Each task is one GitHub issue with the same number: **T01 = #1 … T20 = #20** in [Alseals1/family-calendar-app](https://github.com/Alseals1/family-calendar-app/issues). The issue's "Depends on" line is the source of truth for order; T20 is done by a person.

Every task is test-first (see [plan.md §6](plan.md#6-testing-strategy-tdd)): the **Tests first** list is written and committed failing before any implementation code. "Gate" marks items G.O.A.T. always gates (migration, auth/permissions, new dependency, CI).

Sizes follow G.O.A.T.: S, M, L (stacked PRs), XL (split first).

## Milestone 0 — Foundation

### T01 · Scaffold the app and the test harness — M
- **Depends on:** none · **Gate:** new dependencies, CI
- **Scope:** Next.js + TypeScript strict + Tailwind + shadcn/ui + Lucide; ESLint; Vitest + RTL; Playwright (desktop + phone projects); npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:integration`, `test:e2e`; `.nvmrc`; `.env.example`; skeleton README.
- **CI (needed by the autopilot):** `.github/workflows/ci.yml` runs on `pull_request` into `dev` with types `[opened, synchronize, reopened, edited, ready_for_review]` ("edited" so a re-targeted stack part is re-tested) and on `push` to `dev`; jobs: lint, typecheck, unit tests, build, Playwright (Chromium cached). `test:db` / `test:integration` steps are added in T02 once Supabase exists. Use `permissions: contents: read`.
- **Tests first:** a Vitest smoke test of a tiny util; a Playwright spec that loads `/` and sees the app name.
- **Done when:** every script runs green locally and in CI.

### T02 · Local Supabase and client helpers — S
- **Depends on:** T01 · **Gate:** new dependency (`@supabase/ssr`, `supabase-js`)
- **Scope:** `supabase init`, local config (Mailpit on), `lib/supabase/{client,server,middleware}.ts`, type generation script, `seed.sql` placeholder.
- **Tests first:** an integration test that connects to the local stack and gets a health response.
- **CI:** add `supabase/setup-cli`, `supabase start`, `npm run test:db` and `npm run test:integration` to the CI job, and run Playwright against the local stack from then on.
- **Done when:** `supabase start` + `npm run test:integration` pass locally and in CI; README has the local setup steps.

### T03 · Database schema migration — M
- **Depends on:** T02 · **Gate:** database migration
- **Scope:** all six tables, checks, composite FKs, indexes, `updated_at` triggers, profile-on-signup trigger, immutable `created_by`/`family_id` trigger (plan §4). RLS **enabled with no policies** (deny-all) until T04.
- **Tests first (pgTAP):** tables and columns exist; `end_time <= start_time` rejected; visibility/calendar_type mismatch rejected; child with `user_id` rejected; adult without `user_id` rejected; cross-family assignment rejected by FK; profile row created on signup; bad color rejected.
- **Done when:** `npm run test:db` passes; types regenerated.

### T04 · RLS policies, helper functions and the privacy suite — L
- **Depends on:** T03 · **Gate:** database migration, permissions
- **Scope:** helper functions, every policy in plan §4, avatars storage bucket policies. (RPCs come with the features that use them.)
- **Tests first (pgTAP)** — the PRD §8 privacy scenarios, plus:
  - B cannot select / update / delete A's private event, or select its assignments.
  - B can select A's shared and family events.
  - B can update and delete A's **family** event (D-03), but not A's shared or private ones.
  - A user in another family sees zero events of any visibility, zero members, zero invitations.
  - A user cannot insert an event with someone else's `created_by` or into another family.
  - Changing an event from shared to private hides it from B immediately.
- **Tests first (API level, `test:integration`):** the same core scenario with two real local users and supabase-js: B's REST query by A's private event id returns no row; B's update/delete affects 0 rows.
- **Done when:** both suites pass. This task is reviewed with extra care.

## Milestone 1 — Authentication

### T05 · Register, log in, log out, protected routes — M
- **Depends on:** T02, T03 · **Gate:** authentication
- **Scope:** `/register`, `/login`, logout action, middleware session refresh, route protection, redirect to `/onboarding` (no family) or `/calendar` (has family). Email confirmation required (AUTH-7); the confirmation link lands on `/auth/confirm`.
- **Tests first:** zod schemas (unit); redirect logic as a pure function (unit).
- **E2E:** register → confirm via the Mailpit email → onboarding; log out → `/calendar` redirects to `/login`; log in → lands correctly; wrong password shows an error.

### T06 · Password reset — S
- **Depends on:** T05 · **Gate:** authentication
- **Scope:** `/forgot-password`, email link, `/reset-password`, password change in Settings later reuses the form.
- **E2E:** request reset → read email from Mailpit → set new password → log in with it.

## Milestone 2 — Family

### T07 · Create a family (onboarding) — M
- **Depends on:** T04, T05 · **Gate:** database migration (RPC)
- **Scope:** `create_family` RPC; onboarding screen (family name, your display name, your color).
- **Tests first (pgTAP):** RPC creates family + owner adult; refuses a second family for the same user; unauthenticated call refused.
- **E2E:** new user creates "The Smiths" → lands on the family calendar → Family screen lists them as owner.

### T08 · Invite and accept a spouse — L
- **Depends on:** T07 · **Gate:** database migration, permissions
- **Scope:** `create_invitation`, `accept_invitation`, revoke; invite form on Family screen; `/invite/[token]` page that handles logged-out (register/login then return) and logged-in users; after creating an invite the inviter sees the link with a Copy button (no invite email, D-02); toasts "Invitation sent" / "Invitation accepted".
- **Tests first (pgTAP):** token hash stored, raw token not; any adult can update/delete a family event created by the other adult (D-03) — covered in T04; wrong email refused; expired refused; revoked refused; reuse refused; family-full refused; user already in a family refused.
- **E2E (two browser contexts):** A creates an invite and copies the link → B opens the link, registers with the invited email, accepts → both see each other on the Family screen.

### T09 · Family screen: members, child profiles, removal — M
- **Depends on:** T07 · **Gate:** database migration (remove/leave RPCs, storage)
- **Scope:** list adults and children; add / edit / delete child (name, color, optional photo ≤ 1 MB); change own color; owner removes an adult; leave family (D-05); revoke pending invites.
- **Tests first:** child form schema (unit); pgTAP for `remove_member` / `leave_family` rules and storage policies.
- **E2E:** add "Mia" (green) and "Leo" (orange); edit Mia's color; delete Leo; upload a photo.

## Milestone 3 — App shell

### T10 · App layout and navigation — S
- **Depends on:** T05
- **Scope:** sidebar (desktop) / bottom tab bar (mobile) with Home, Calendar, Family, Settings; page headers; toaster; empty states.
- **Tests first:** nav component renders the four items and marks the active one (component).
- **E2E:** navigation works at 1280×800 and 390×844; no horizontal scroll on phone.

## Milestone 4 — Events and calendar

### T11 · Event logic and server actions — M
- **Depends on:** T04
- **Scope:** zod event schema; `defaultEventTimes`; all-day conversion (D-08); create / update / delete server actions with assignments (replace set on update); range query; `applyScope`; `applyMemberFilter`; `eventColor` + `readableTextColor`.
- **Tests first (unit):** every function in plan §5, including rounding at :00/:29/:30/:59, end-before-start rejected, all-day dates stable in `America/Chicago` and `Asia/Tokyo`, multi-day events, scope rules for My / Family / All, filter by child, contrast ≥ 4.5.
- **Tests first (integration):** create → read back → update visibility → delete, as a real local user.

### T12 · Event form, details and delete — M
- **Depends on:** T10, T11
- **Scope:** create/edit form in a dialog (desktop) / bottom sheet (phone): title, date, start, end, all-day toggle, location, description, assigned members (chips with colors), visibility selector with the three plain-language labels; details view; delete with confirm (in-app dialog, not a browser `confirm()`); toasts.
- **Tests first (component):** defaults applied; all-day hides times; end-before-start shows an error and blocks submit; visibility labels exactly "Private — Only you", "Shared — You and your spouse", "Family — Visible to the family".
- **E2E:** create, view, edit, delete an event; create "Soccer Practice" assigned to Mia, Family visibility.

### T13 · Month view — M
- **Depends on:** T11, T12
- **Scope:** month grid, prev/next, today, select a date, tap a date to create, "+N more" overflow, colored event chips, multi-day bars.
- **Tests first (component):** correct grid for a month starting on Sunday vs Monday; event lands on the right day(s); today is highlighted.
- **E2E:** navigate months; tap a date → form opens with that date.

### T14 · Week and agenda views — M
- **Depends on:** T13
- **Scope:** week time grid on desktop, day-section list on phone (CAL-7); agenda list grouped by day for the next 30 days; view switcher that remembers the last view.
- **Tests first (component):** week boundaries; agenda grouping and ordering; all-day events shown above timed events.
- **E2E:** switch Month → Week → Agenda at both screen sizes.

### T15 · Scopes, member filters and the privacy E2E — M
- **Depends on:** T08, T14
- **Scope:** My / Family / All visible switcher; member filter chips in each member's color; consistent colors across views.
- **E2E (two contexts, PRD §8):** A creates Private, Shared and Family events → B sees Shared + Family under All visible and Family under Family Calendar, never the Private one; A switches Shared → Private and it disappears for B; filter by Mia shows only Mia's events.

## Milestone 5 — Screens

### T16 · Home screen — S
- **Depends on:** T14
- **Scope:** today's schedule, upcoming (7 days), family members row, quick "+ Event".
- **Tests first (component):** today/upcoming split, empty state.
- **E2E:** an event created for today appears on Home.

### T17 · Settings screen — M
- **Depends on:** T09, T10, T06
- **Scope:** account (email shown, change password), profile (name, photo, color), family (rename if owner, leave family), calendar preferences (week starts on, default view — stored on the profile), log out.
- **Tests first:** preferences schema (unit); pgTAP if new columns are added (gate: migration).
- **E2E:** change week start → month grid starts on Monday; log out.

## Milestone 6 — Hardening and release readiness

### T18 · Full regression, mobile and accessibility pass — M
- **Depends on:** T15, T16, T17
- **Scope:** run every PRD §8 criterion as one Playwright suite at both sizes; axe accessibility checks on each screen; fix findings.
- **Done when:** all 17 acceptance criteria pass in CI.

### T19 · README and deployment readiness — S
- **Depends on:** T18
- **Scope:** README sections required by the spec (overview, stack, install, env, Supabase setup, migrations, dev, testing, deployment); verify a clean clone runs with only the README.

### T20 · Production deploy — S · **owner-led**
- **Depends on:** T19, owner creates the hosted Supabase project and Vercel project
- **Scope:** apply migrations to the hosted project, set Vercel env vars, set Supabase auth redirect URLs and Resend SMTP (D-02), smoke test in production.
- **Note:** agents never run commands against a hosted project; the owner runs or approves each step.
- **Phase 1 close-out:** remove the "Phase 1 questions" section from `CLAUDE.md` and stop Claude's question watcher. From then on the owner answers G.O.A.T. questions again.

## Order and parallel work

```
T01 → T02 → T03 → T04 ─┬→ T07 → T08 ─────────────┐
            T05 ───────┤   T07 → T09 ─────────┐   │
            T05 → T06  └→ T11 → T12 → T13 → T14 ┴→ T15 → T16 ┐
            T05 → T10 ──────────↗                    T17 ──────┴→ T18 → T19 → T20
```

After T04 and T05, the family track (T07–T09) and the events track (T10–T14) can run in parallel.
