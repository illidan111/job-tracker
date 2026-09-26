# Verification record

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

Screenshots were visually inspected for hierarchy, spacing, density, contrast, mobile forms and theme consistency. Final adjustments corrected separator characters, upcoming-section spacing, a duplicate Remote label, and the date-only formatting of follow-up reminders. The final reminder adjustment received a focused browser workflow and accessibility rerun.

Representative captures from the actual application with isolated demo data:

- [Overview](images/overview.png)
- [Sign-in](images/sign-in.png)
- [Application details](images/application-details.png)

## Scope and limits

No deployment was performed. Authentication is local email/password with database sessions; email verification, password reset delivery and MFA are not implemented. Reminders are in-app only. The API is bound to loopback for local use. The database is SQLite on the API host, with no managed cloud backup. Other browser engines, screen readers, and public-hosting operations remain outside the verified scope.
