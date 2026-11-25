# Family Calendar — Product Requirements (Phase 1 MVP)

Status: **v1.0 — approved by the owner 2026-11-23; all decisions D-01 to D-12 are Decided** (see [Decisions](#11-open-decisions)).
Last updated: 2026-11-23.

## 1. Vision

A private family scheduling app. Each adult has a personal calendar and controls which of their events the other adult can see. The family shares one calendar for household events and the children's activities.

> Help families coordinate their schedules while keeping control over personal calendar privacy.

It should feel like a clean, modern family organizer, not a business productivity tool.

## 2. Users

| User | Has a login? | What they do |
| --- | --- | --- |
| Adult (e.g. husband, wife) | Yes, own account | Owns a personal calendar, creates family events, manages child profiles |
| Child | No | A profile with a name and color. Events are assigned to them. |

Phase 1 allows **two adult accounts per family**. The data model must allow more adults later.

## 3. Goals and non-goals

**Goals for Phase 1**
- Two adults can each sign up, form one family, and see each other's shared events and all family events.
- Private events stay private, **enforced by the database** (Row Level Security), not just hidden in the UI.
- Fast event creation on a phone.
- Runs entirely on free tiers (Supabase Free, Vercel Hobby, GitHub).

**Non-goals for Phase 1** are listed in [section 9](#9-out-of-scope-phase-1).

## 4. Visibility model (the core rule)

| Visibility | Label in the UI | Who sees the event | Which calendar |
| --- | --- | --- | --- |
| `private` | Private — Only you | Only the creator. Other adults get **nothing**: no row, no title, no time, no "busy" block, no assignments. | Creator's personal calendar |
| `shared` | Shared — You and your spouse | The creator and every other adult in the family | Creator's personal calendar (shown to the spouse under "All visible") |
| `family` | Family — Visible to the family | Every adult in the family | Family calendar |

Rules:
- Visibility is enforced in Postgres with RLS. A user calling the Supabase API directly, with their own token, must not be able to read a private event they did not create, or its assignments.
- `calendar_type` is derived from visibility: `family` visibility means the family calendar; `private` and `shared` mean the creator's personal calendar. The database rejects any other combination. *(D-07.)*
- Changing an event's visibility takes effect immediately for every query.

## 5. Functional requirements

IDs are referenced by tasks and tests.

### 5.1 Authentication
- **AUTH-1** Register with full name, email and password.
- **AUTH-2** Log in and log out.
- **AUTH-3** Reset a forgotten password by email link.
- **AUTH-7** New accounts confirm their email address before first login. Auth emails go through Resend (custom SMTP in Supabase) in production and Mailpit locally (D-02).
- **AUTH-4** Sessions persist across reloads. All app routes require a session; unauthenticated visits go to `/login`.
- **AUTH-5** After login: go to the calendar if the user belongs to a family, otherwise to family setup.
- **AUTH-6** A user can never read or change another family's data.

### 5.2 Family management
- **FAM-1** Create a family with a name. The creator becomes the family **owner** and its first adult member.
- **FAM-2** Invite another adult by email address. The invite is a single-use link that expires after 7 days. The inviter copies the link and sends it themselves (text, chat); the app sends no invite email (D-02).
- **FAM-3** Accept an invitation. Only the account whose email matches the invite can accept it. Accepting is refused when the family already has the maximum number of adults (2 in Phase 1).
- **FAM-4** View family members (adults and children).
- **FAM-5** Remove a member. The owner can remove another adult; any adult can remove a child profile; an adult can leave a family. *(D-05.)*
- **FAM-6** Revoke a pending invitation.
- **FAM-7** One family per user in Phase 1. *(D-06.)*

### 5.3 Family member profiles
- **MEM-1** Any adult can create, edit and delete child profiles: name, optional photo, calendar color.
- **MEM-2** Children have no email or password.
- **MEM-3** Every member has a calendar color; adults can change their own color.
- **MEM-4** Optional profile photo, small image upload (up to 1 MB, jpg/png/webp). Members without a photo show initials.

### 5.4 Events
- **EVT-1** Fields: title (required), description, start date/time, end date/time, all-day flag, location, assigned members (0..n), visibility, calendar type, created by, created at, updated at.
- **EVT-2** Create, view details, edit, and delete events.
- **EVT-3** Assign an event to one or more family members, including children.
- **EVT-4** All-day events, single or multi-day.
- **EVT-5** Validation on the client **and** on the server **and** by database constraints: title required, end must be after start.
- **EVT-6** Display in the viewer's local time zone. Timestamps are stored in UTC (`timestamptz`). All-day events are stored as calendar dates so they never shift a day across time zones. *(D-08.)*
- **EVT-7** Defaults: start = now rounded up to the next 30 minutes; duration 1 hour; visibility = Family when created from the Family calendar, otherwise Private. *(D-09.)*
- **EVT-8** Edit and delete rights: the creator can always edit or delete their own events. Any adult in the family can edit or delete a **family** event (D-03). Private and shared events can be changed only by their creator.
- **EVT-9** No recurrence in Phase 1 (D-04). Each event is a single occurrence.

### 5.5 Calendar
- **CAL-1** Month, week and agenda (list) views.
- **CAL-2** Previous / next, jump to today, select a date.
- **CAL-3** Click or tap a date (or the "+" button) to create an event on that date.
- **CAL-4** Scope switcher:
  - **My Calendar**: my own private and shared events.
  - **Family Calendar**: family events.
  - **All visible**: everything I am allowed to see (my events, my spouse's shared events, family events).
- **CAL-5** Filter by family member (show events assigned to the selected members; adults' own personal events count as theirs).
- **CAL-6** Color coding is consistent across calendar cells, event cards, agenda rows and filter chips. Event color = the first assigned member's color; unassigned family events = gray; unassigned personal events = the creator's color. Text color is chosen automatically for readable contrast (WCAG AA 4.5:1).
- **CAL-7** Works on phones (390 px wide) without feeling cramped. On phones the week view becomes a list of seven day sections instead of a 7-column grid.

### 5.6 App screens
- **UI-1** Navigation: Home, Calendar, Family, Settings. Sidebar on desktop, bottom tab bar on mobile.
- **UI-2** Home: today's schedule, upcoming events (next 7 days), family members, quick "+ Event" button.
- **UI-3** Calendar: navigation, view selector, scope switcher, member filters, "+ Event" button.
- **UI-4** Family: adults, children, invite, member management.
- **UI-5** Settings: account (email, password change), profile (name, photo, color), family (name, leave family), calendar preferences (week starts on Sunday/Monday, default view), log out.
- **UI-6** Toasts for: event created / updated / deleted, invitation sent, invitation accepted, errors.

## 6. Non-functional requirements
- **NFR-1 Security**: RLS on every table; no service-role key in the browser or the repo; secrets only in environment variables; `.env.example` committed.
- **NFR-2 Privacy tests** must pass before the MVP is done (section 8).
- **NFR-3 Mobile-first**, responsive from 360 px to desktop.
- **NFR-4 Accessibility**: keyboard reachable, labelled form fields, AA color contrast.
- **NFR-5 Free tier**: stay inside Supabase Free (500 MB database, 1 GB storage, 50k monthly active users) and Vercel Hobby. Note: Supabase pauses a free project after about a week without activity.
- **NFR-6 Code quality**: TypeScript strict, no unexplained `any`, small modular components, lint and type check clean.
- **NFR-7 Extensible**: the schema allows more adults, and later Phase 2/3 features (sync, recurrence, conflicts) without a rewrite.

## 7. Key user flows
1. **Onboarding**: register → confirm email → no family → "Create family" → family calendar.
2. **Spouse joins**: owner creates an invite and texts the link → spouse opens link → registers or logs in with the invited email → accepts → family calendar.
3. **Kid's activity**: tap Saturday → "Soccer Practice", 9:00–10:00, location "Soccer Field", assign Child 1, visibility Family → shows in green on both adults' family calendars.
4. **Private appointment**: create "Doctor", Private → visible to me only; my spouse's calendar and API return nothing.
5. **Share one event**: change "Work dinner" from Private to Shared → it appears for my spouse under "All visible".

## 8. Acceptance criteria (MVP done)
The MVP is complete when all of these are true and demonstrated by passing tests:

1. A user can register and log in. *(E2E)*
2. A user can create a family. *(E2E + DB)*
3. A user can invite their spouse. *(E2E)*
4. The spouse can join the family. *(E2E, two browsers)*
5. Parents can create child profiles. *(E2E)*
6. Users can create personal events. *(E2E)*
7. Users can create family events. *(E2E)*
8. Users can assign events to children. *(E2E + DB)*
9. Users can mark events as private. *(E2E + DB)*
10. Users can share selected events. *(E2E + DB)*
11. Users can view the family calendar. *(E2E)*
12. Users can filter by family member. *(unit + E2E)*
13. Users can view month, week and agenda calendars. *(component + E2E)*
14. Users can edit and delete events. *(E2E + DB)*
15. Private events are protected by database-level security. *(pgTAP + API-level test)*
16. The app works on desktop and mobile. *(E2E at 1280×800 and 390×844)*
17. The project runs locally using the README. *(manual check from a clean clone)*

**Privacy scenarios (must pass, at the database and the API level):**
- A creates a **private** event; B (same family) cannot select it, its assignments, or update/delete it, by any query.
- A creates a **shared** event; B can view it.
- A creates a **family** event; A and B can both view it.
- A user from **another family** sees none of A's events of any visibility.

## 9. Out of scope (Phase 1)
- **Phase 2**: conflict detection, scheduling recommendations, Google / Apple calendar integration, external sync, advanced recurring events, school calendar imports.
- **Phase 3**: AI assistant, smart recommendations, travel time, schedule optimization, childcare coordination, AI event suggestions.
- Also not in Phase 1: push notifications, email reminders, child logins, more than one family per user, more than 2 adults per family (schema-ready only), native mobile apps.

## 10. Free-tier constraints to remember
- Supabase's built-in email sender is for testing only: it is heavily rate-limited and (as of my knowledge, to be verified when we connect the project) only delivers to addresses on the Supabase project team. Real sign-up confirmation, password reset and invite emails in production need a custom SMTP provider (e.g. Resend's free tier). Decided in D-02: Resend free tier for auth emails; invites are links, not emails.
- Vercel Hobby is for personal, non-commercial use. Fine for a private family app; a paid plan is needed if this becomes a commercial product.
- A Supabase free project pauses after about 7 days of no activity, and has no automatic backups you can restore yourself.

## 11. Open decisions

The decision log. Agents build only on **Decided** rows. A new decision is added here by the owner before it is built.

| ID | Decision | Recommendation | Status |
| --- | --- | --- | --- |
| D-01 | Who builds the tasks | All tasks, including the scaffold, go through G.O.A.T. AI as GitHub issues | **Decided** 2026-11-23 |
| D-02 | How invitations and auth emails are delivered | Invites: copyable single-use link, no email. Auth emails (confirmation, password reset): Resend free tier via Supabase custom SMTP in production; Mailpit locally | **Decided** 2026-11-23 |
| D-03 | Can the other adult edit/delete **family** events they did not create? | Yes, any adult in the family | **Decided** 2026-11-23 |
| D-04 | Any recurrence in Phase 1? | None; schema leaves room for Phase 2 | **Decided** 2026-11-23 |
| D-05 | Removal rights: owner removes adults; any adult manages children; an adult can leave. When an adult leaves, their private/shared events in that family are deleted and their family events stay. | As written | **Decided** 2026-11-23 |
| D-06 | One family per user in Phase 1 | Yes | **Decided** 2026-11-23 |
| D-07 | `calendar_type` derived from visibility (family ⇔ family calendar), enforced by a DB check | Yes | **Decided** 2026-11-23 |
| D-08 | All-day events stored as dates (start date at 00:00 UTC, exclusive end date) and shown without time-zone shifting | Yes | **Decided** 2026-11-23 |
| D-09 | Default visibility Private outside the Family calendar | Yes | **Decided** 2026-11-23 |
| D-10 | "Shared" means shared with **all** adults in the family (= the spouse in Phase 1). Per-person sharing waits for >2 adults. | Yes | **Decided** 2026-11-23 |
| D-11 | Custom calendar UI built with `date-fns` instead of a calendar library (better mobile layout, easier to test, no license issues) | Yes | **Decided** 2026-11-23 |
| D-12 | Test stack: Vitest + React Testing Library (unit/component), pgTAP via `supabase test db` (RLS), Playwright (E2E) | Yes | **Decided** 2026-11-23 |
| D-13 | Member color palette (onboarding, children, settings, event colors) | Fixed list of 8 named colors, lowercase hex: Blue `#2563eb` (default), Green `#16a34a`, Orange `#ea580c`, Purple `#9333ea`, Red `#dc2626`, Teal `#0d9488`, Pink `#db2777`, Amber `#ca8a04`. No gray (reserved for unassigned family events, CAL-6). Members may share a color. | **Decided** 2026-11-25 by Claude for the owner (Phase 1), #7 |
