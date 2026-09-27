# Verification record

## Journey experience cycle - 2026-09-27

Started from clean `a1a41c2` on main. Before implementation, inspected the running application in Edge on an isolated database and wrote [Journey design diagnosis](JOURNEY_DESIGN.md). After implementation, inspected the rendered Home, Applications, Kanban, detail, Journey, Analytics and supporting screens, forms, empty states and mobile navigation, then iterated on hierarchy, spacing and controls. The computer-use connector could not initialize; the repository's real Playwright/Edge browser was used instead.

- ESLint, TypeScript and all **52 unit/API tests** pass. Coverage includes real rewards, two concurrent submissions, repeated edits and preparation UPSERTs, 100 create/delete attempts, daily caps, transaction rollback, import/demo suppression, owner isolation, rejected client XP/achievement fields, quest completion, levels/evolution boundaries, UTC streaks and migration/backfill persistence. An upgrade regression preserves existing XP/achievements while replacing early local triggers with explicit conflict handling.
- The complete Edge run passed **51 of 53** scenarios. Two responsive CRM checks failed because their old loading locator assumed a single indicator; Calendar legitimately has two concurrent loading regions. Changed the assertion to wait for zero loading indicators. The targeted rerun passed **both** remaining scenarios. All 53 scenarios therefore passed across the full run and targeted rerun, with none skipped.
- The new end-to-end Journey scenario registers a real isolated account, submits an application (30 XP), checks Home/Journey and the first achievement, selects a cat, creates/completes a contextual task (45 XP), schedules/completes an interview (130 XP, level 2), then refreshes and signs out/in. XP, achievement and companion persist. It also exercises mobile, reduced motion and workspace progress opt-out.
- Main routes and forms fit **320, 375, 390, 430, 768, 1024, 1440 and 1920 px**, light and dark. Axe WCAG A/AA checks pass at 375/1440 in both themes. Existing keyboard focus, dialogs, mobile navigation, non-drag status changes, bulk actions, filtering, imports, error recovery and authentication tests continue to pass.
- Production build and local compiled smoke pass: CSP, deep links, authenticated sessions, 24 applications and CRM records survive an API restart; the smoke additionally verifies persisted task XP and hare selection. No deployment occurred. No dependencies were added.

Production output: entry JavaScript **382.82 kB / 119.75 kB gzip**, CSS **102.96 kB / 20.02 kB gzip**; Journey **8.17 kB / 2.94 kB gzip** and shared companion/progress **4.82 kB / 2.11 kB gzip**. Analytics' chart code is separately loaded (**361.17 kB / 104.63 kB gzip**) and is no longer on Home. Layout owns one shared overview request and one Journey aggregate; inline companions need no image fetches or animation library. Rewards use indexed, owner-scoped queries and remain inside domain transactions; no load benchmark is claimed.

The existing local development watcher applied an early version of migration 004 during implementation. Migration 005 was tested and explicitly applied to the configured local database; it only replaces two trigger definitions and retains all existing progress. Test accounts and visual audit data were isolated from that database.

Known verification limits: no manual screen-reader session or Firefox/WebKit run. Automated accessibility checks do not establish complete accessibility. Reward eligibility records product actions, not externally verified employer interactions. Calendar/profile timezone behavior is preserved; Journey weeks/activity use documented UTC boundaries. JSON workspace imports preserve the current account's reward ledger but do not restore another ledger; a full database backup is needed for complete progress recovery. See [GAMIFICATION.md](GAMIFICATION.md) for these deliberate boundaries.

## Career CRM cycle - 2026-09-27

The repository was inspected at baseline commit `7558212`; findings and scope are in [Career CRM audit](CAREER_CRM_AUDIT.md). Work kept the existing visual system and authentication architecture, introduced no package dependencies, and used isolated test databases throughout.

Verified checks:

- TypeScript, ESLint and 42 Vitest tests pass. New HTTP tests cover shared companies, task completion/idempotent retries/conflicts, notes, materials, preparation, foreign-owner access, timezone projection, complete v4 backup restoration and transactional rollback. A 215-application fixture verifies pagination and aggregates beyond bootstrap size. The migration test checks preserved application/interview/activity rows, company backfill, indexes and foreign-key integrity.
- The complete CRM browser journey passes: saved job, conversion, company research, recruiter, conversation note, materials, interview preparation, follow-up, task completion, status/history, Today/calendar, overview/analytics, grouped search/filtering, v4 export/import, refresh, logout/login and a second account's rejected direct links/API requests.
- New CRM layout/dialog checks pass at 320, 375, 768, 1024 and 1440 px in light mode, plus 375 and 1440 px in dark mode. Axe WCAG A/AA checks pass on the new routes and dialogs at 375/1440 in both themes. Calendar selection, modal Escape, command-search keyboard focus and viewport bounds are exercised. Actual desktop Today and mobile dark-calendar screenshots were inspected.
- The local production smoke passes with compiled assets, CSP, deep links and persisted sessions, 24 applications, tasks and materials after restarting the API. It uses a temporary database; no deployment occurs.
- `npm audit --omit=dev` reports zero known vulnerabilities.

The production build has an entry JavaScript chunk of 372.87 kB (116.67 kB gzip), CSS 80.71 kB (15.78 kB gzip) and a separately loaded chart chunk of 375.64 kB (108.34 kB gzip). New Today/calendar screen chunks are about 2.7 kB each before gzip. Collection queries and aggregate responses avoid hydrating the whole application corpus into the browser; server analytics still do work proportional to the local dataset.

Initial browser passes found real regressions in temporary Kanban moves, expired-session races, invalid page links, loading-state rendering and calendar contrast. Those were corrected and verified again. Backup assertions were updated from version 3 to version 4, the failure-injection test now targets the smaller reminder refresh, and the registration landing assertion follows the new Today default while still checking an empty isolated account.

The final complete Edge run passed 47 of 48 scenarios. Its only failure was the outdated registration landing assertion; after updating that assertion to Today, `playwright test --last-failed` passed the remaining scenario. All 48 scenarios have therefore passed across the complete run and that targeted rerun; no scenario was skipped. Automated accessibility checks do not substitute for manual screen-reader testing. Chromium/Edge is the verified browser engine; Firefox/WebKit, hosted operations and offline behavior are not claimed.

## Job-search workflow expansion — 2026-09-27

The migration from the previous database schema was exercised with an actual pre-migration application and interview; both records and their new default fields survived. API tests cover account isolation for saved jobs, version conflicts, atomic conversion, bulk ownership/rollback, archive restoration, and backup validation. A new browser journey covers saved job → application → contact/follow-up/interview → Kanban → analytics/filter → archive/restore → command palette → export/reload.

The previous 33 unit/API tests remain in place. This pass has **38 unit/API tests**, including backup round-trips for version 3. TypeScript, ESLint, and the production build pass. The complete Edge browser suite has **40 passing scenarios**, including responsive and axe checks. The production smoke passes with the compiled UI, CSP, deep links, authenticated sessions and persistence across an API restart. `npm audit --omit=dev` reports zero known vulnerabilities. No deployment was performed.

## Engineering hardening — 2026-09-27

See [Engineering audit](ENGINEERING_AUDIT.md) for the starting architecture, concrete findings and fixes. Checked with Node 24.14.0 on Windows and installed Microsoft Edge.

| Command/check | Result |
| --- | --- |
| `npm test` | 33 passed: 16 HTTP/database, 14 domain/validation and 3 workspace recovery tests |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run test:e2e` with `PLAYWRIGHT_CHANNEL=msedge` | 39 passed in the complete final workflow run |
| Final CSS verification | All 16 responsive/accessibility tests passed again after explicit Tailwind source scoping; production smoke passed again; source-copy and Git-worktree CSS had identical SHA-256 hashes |
| `npm run test:production` | Passed: real compiled UI, CSP, deep links, session and application persistence after API restart |
| Clean source installation | `npm ci`, build, 33 tests, migration and seed passed; a second seed correctly refused to overwrite data |
| Dependency checks | `npm audit --omit=dev` and the full audit during clean `npm ci` both reported zero known vulnerabilities |
| Git hygiene | Required sample source included; local databases, `.env`, dependencies and test artifacts excluded |

The expanded account journey registers in the UI, creates an application with salary, location, URL, tags and notes, edits it, moves it through Kanban, reloads, logs out/in, searches and filters it, reads notes and analytics, and changes/reloads the weekly goal. HTTP tests independently verify cross-account isolation. New regressions cover transaction rollback at the interview limit, repeated contact linking, invalid goals and owner spoofing, local date boundaries, completed-interview conversion history, malformed page links, empty analytics, startup recovery and post-save refresh failures.

Responsive checks covered 320, 375, 768, 1024, 1440 and 1920 px in light and dark themes. All main routes and forms fit their viewport; the board scrolls within its container. Automated axe checks at 375 and 1440 px passed for both themes. Actual screenshots of login, overview, applications, detail, Kanban, populated and empty analytics, and the mobile edit form were inspected for clipping and layout defects.

The first expanded browser run had an ambiguous weekly-goal test locator and a settings page reload during concurrent local verification work. The locator was made role-specific; both scenarios then passed, followed by the complete 39-test run. No test was skipped or assertion relaxed. The Windows sandbox initially prevented `tsx` from calling `uv_os_get_passwd`; browser/server checks were rerun with local process access.

The clean-install check used only the intended source files in a temporary ignored directory, its own dependencies, a new SQLite database and a generated test password. It did not copy or change the normal workspace database. No deployment was performed.

## Earlier verification

The subsequent 2026-09-27 interface refinement, review passes, and final verification results are recorded in [Design review](DESIGN_REVIEW.md). Screenshots below reflect that refinement.

Checked on 2026-09-26 with Node 24.14.0 on Windows, using installed Microsoft Edge through Playwright. Tests use separate databases and accounts; the normal workspace is not used as a test fixture.

## Baseline and preserved behavior

The repository began as a working React/Vite frontend with localStorage persistence, no API or authentication, and an uncommitted source tree. The existing layout, green/off-white palette, sidebar, responsive table, native dialogs, Kanban, charts, filters and keyboard controls were retained. Persistence and workspace state were replaced with authenticated API operations; localStorage remains only as an explicit legacy import source.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript frontend, API and build configuration | Passed |
| Production Vite build | Passed |
| ESLint | Passed |
| Vitest | 24 tests passed: 12 HTTP/database tests and 12 data/validation tests |
| Full Playwright regression suite | 35 tests passed |
| Production smoke test | Passed: compiled UI, CSP, deep links, sessions and 24 applications after a server restart |
| Migration and seed commands | Passed; repeat seed correctly refused to overwrite records |
| npm dependency audit | No known vulnerabilities reported |

The browser suite covers:

- Sign-up, duplicate accounts, wrong credentials, sign-out, protected routes, session refresh and a second user's empty workspace.
- Validated create/edit/delete, details, search, combined filters, sorting, pagination and real-data analytics.
- Actual pointer drag-and-drop, saved status/timeline, optimistic rollback after a rejected request, keyboard status changes and refresh persistence.
- Multiple interview records and outcomes, upcoming conversations, editing/deleting interviews, follow-up completion and persistent read reminders.
- Creating, reusing, editing and unlinking contacts across applications.
- JSON export/import, invalid import rejection, reset/clear confirmation and explicit recovery from malformed legacy browser data.
- A failed create retaining its draft, stale revision rejection with an explicit retry, expired-session private-state clearing, and operation without writable localStorage.
- Mobile navigation, focus restoration, Escape/discard dialogs, empty states and unavailable routes/records.

The API suite independently exercises foreign-user reads and mutations, foreign contact linking, composite ownership foreign keys, session expiry/revocation, password/session response hygiene, CSRF origin/content checks, unsafe URLs, invalid dates/statuses, rate limiting, import rollback and user-specific profile/data replacement.

## Responsive, accessibility and visual review

Layout checks cover **320, 375, 768, 1024, 1440 and 1920 px**, in both light and dark themes. Main pages, authentication screens and application/interview/contact dialogs are checked for accidental document or dialog horizontal overflow. Intentional Kanban scrolling stays inside its board.

The axe checks cover WCAG 2 A/AA and 2.1 AA on all main pages, authentication screens and key dialogs at 375 and 1440 px in both themes. No violations remained in these automated checks. Normal browser flows were checked for page errors, and the visual tests also check console errors/warnings. These checks supplement, rather than replace, assistive-technology testing.

An earlier visual pass caught a light-theme metadata contrast issue in a full Playwright run (32 of 35 checks passed). After the color fix, all four focused axe checks passed; the earlier dark-theme dialog timeout also passed on rerun.

In the following presentation redesign, responsive and axe checks passed at all tested widths and themes. A full-row recent link changed its accessible name; 34 of 35 Playwright checks passed initially, and the complete failing workflow passed after giving that link the company name. The production restart smoke test passed again. See [the current four-iteration review](DESIGN_REVIEW.md) for the current before/after captures.

Screenshots were visually inspected for hierarchy, spacing, density, contrast, mobile forms and theme consistency. Final adjustments corrected separator characters, upcoming-section spacing, a duplicate Remote label, and the date-only formatting of follow-up reminders. The final reminder adjustment received a focused browser workflow and accessibility rerun.

Representative captures from the actual application with isolated demo data:

- [Overview](images/overview.png)
- [Sign-in](images/sign-in.png)
- [Application details](images/application-details.png)

## Scope and limits

No deployment was performed. Authentication is local email/password with database sessions; email verification, password reset delivery and MFA are not implemented. Reminders are in-app only. The API is bound to loopback for local use. The database is SQLite on the API host, with no managed cloud backup. Other browser engines, screen readers, and public-hosting operations remain outside the verified scope.
