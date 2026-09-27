# Architecture and data ownership

Waypoint keeps its existing React interface and adds a same-origin TypeScript API. React Router loads screens on demand; Zustand holds the authenticated workspace cache and transient saving/error state. React Hook Form and shared Zod schemas validate forms. Express validates every write again before the repository touches SQLite.

```mermaid
flowchart LR
  UI[React / Router / Zustand] -->|same-origin JSON + HttpOnly cookie| API[Express API]
  API --> AUTH[Session authentication + origin checks]
  AUTH --> REPO[User-scoped repository]
  REPO --> DB[(SQLite / WAL)]
  SCHEMA[Shared Zod validation] --> UI
  SCHEMA --> API
```

SQLite was selected for a reproducible local setup with no service account, Docker daemon, or paid infrastructure. It is a real relational database file, independent of browser storage. Node's built-in `node:sqlite` removes a native addon build step. This version targets Node 24.14 or newer; that runtime emits an experimental SQLite warning. The API can later be moved to PostgreSQL behind the repository boundary. There is no claim of managed cloud synchronization.

## Relational model

`server/migrations/001_initial.sql` and `002_job_search_workflow.sql` are the schema sources. Migrations are tracked in the `migrations` table and applied atomically on startup; `npm run db:migrate` also runs them explicitly. Migration 002 adds new columns with safe defaults, retaining existing application and interview rows.

| Table | Purpose and relationships |
| --- | --- |
| `users` | Unique case-insensitive email, password hash, profile and preferences |
| `sessions` | Hashed opaque token, user foreign key, absolute expiry |
| `applications` | User-owned opportunity, status, work arrangement, follow-up and revision |
| `saved_jobs` | User-owned opportunities not yet applied to; versioned and converted in one transaction |
| `tags` / `application_tags` | Per-user tag vocabulary and application links |
| `contacts` / `application_contacts` | Reusable user-owned contacts and links |
| `interviews` | Many dated conversations per application with type, URL, notes and outcome |
| `timeline_events` | Meaningful application events, including contact and interview changes |
| `notifications` | Persistent read state for currently relevant reminders |
| `rate_limits` | Expiring sign-in attempt counters |

Composite foreign keys include `userId` for application/contact relations. A cross-owner link fails even if an API check is accidentally omitted. Deleting an application cascades through its links, interviews, timeline, and reminders; reusable contacts remain available. Data replacement clears only that user's records. Queries bind values through prepared statements. The repository groups relation rows in memory after a small fixed set of indexed queries instead of issuing a query for every row.

## Writes and concurrency

- Application writes check the submitted version. A stale version returns **409** and the client refreshes current server data while retaining the open draft. Saving again is an explicit retry. Shared contacts have their own versions; edits update all linked applications and their timelines.
- A Kanban move changes the cache immediately, then persists the status and timeline together. A failed request restores the previous record and displays the API error. A successful save is never undone just because a subsequent reminder refresh failed; refresh errors remain visible with a retry action. A 401 during either post-save refresh or conflict recovery clears private state immediately.
- Mutation controls are serialized in the workspace store. Background refreshes are skipped while saving. An epoch guard prevents an old request from restoring private data after logout or account changes.
- The authenticated workspace refreshes on window focus and every 60 seconds while visible. This is lightweight polling, not real-time collaboration.
- Import validates the entire input on both sides, then replaces records in one transaction. New IDs are assigned to imported entities; shared contact references are remapped consistently. Conflicting versions of the same contact cause a rollback. All prior data remains intact on validation or transaction failure.
- Bulk actions validate every selected application and version before any change; an invalid or foreign-owned ID rolls the entire action back. Archiving keeps the application and timeline, while the active board and reminder generator omit it.
- Version 3 workspace backups include saved jobs. Older formats remain readable. Import can replace both collections together; demo reset and clear affect applications only.

## Authentication and security boundaries

- Passwords use asynchronous scrypt (`N=131072`, `r=8`, `p=1`) with independent random salts. Concurrent hashing is bounded to control memory use. Passwords and hashes never enter frontend responses.
- Session cookies contain 256-bit random tokens; only their SHA-256 digests are stored. Cookies are HttpOnly and SameSite=Strict, with absolute expiration. Sign-in rotates the session and logout revokes it. Secure mode uses a `__Host-` cookie.
- All mutations require the exact configured Origin and JSON content type. No permissive CORS configuration exists. Authentication endpoints also use IP and normalized-email rate limits.
- Every protected route obtains the owner from the session. IDs provided by the browser never select the acting user. Missing and foreign-owned records both return 404.
- Shared schemas constrain field sizes, statuses, calendar dates, URLs, imports, and record counts. Links allow only HTTP(S); React renders user strings as text. Meeting URLs are never fetched by the backend.
- Production responses set CSP, frame restrictions, content sniffing protection and referrer/permission policies. API responses are `no-store`. HTTPS mode adds HSTS and Secure cookies. `.env` files, database files, logs, and test output are excluded from Git.

Implementation references: [Node SQLite](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html), [Express security practices](https://expressjs.com/en/advanced/best-practice-security.html). Deployment would still require HTTPS, backup operations, monitoring, and a review appropriate to the hosting environment. Nothing is deployed by this repository's scripts.

## Product semantics

- Application/follow-up dates are calendar dates. Event and interview timestamps are ISO UTC and displayed in the browser's timezone. Due follow-ups use the server's current calendar date, matching the local installation's clock.
- Salary is annual USD, with no currency conversion implied.
- Conversion counts opportunities with a non-cancelled interview, a retained completed-interview event, or an interview/offer stage in their recorded history; offers imply an interview. Deleting a completed interview does not erase its historical conversion while its event is retained. Rejection rate describes current rejected status, while active excludes offers and rejections. Empty workspaces show no conversion percentage. Weekly goals count Monday through today in the browser's local calendar; monthly progress excludes future dates.
- The saved count is the current wishlist, not a historical conversion denominator. First recorded response timing uses the first non-applied status event on or after the application date; records without such an event are excluded and no average is shown when none qualify. Source percentages use all applications, including archived historical records.
- Upcoming interviews are individual scheduled conversations, including multiple interviews for the same application. Outcomes, cancellations, and deletion remove irrelevant reminders.
- Interview reminders cover the next 48 hours (and one hour after the start); follow-ups include due/overdue incomplete dates. Reminders are generated on workspace reads and retain read state while relevant. They are in-app reminders, not emails or push notifications.
- Timeline retention is the latest 1,000 events per application. The workspace supports up to 10,000 applications, 100 interviews and 30 linked contacts per application, with imports capped at 5 MB. The application table paginates client-side; large-scale multi-tenant loading is outside this local product's scope.
- Legacy recruiter and interview fields are compatibility aliases for normalized relations. Original localStorage data is read only when the user explicitly chooses its import action in Settings and is never overwritten by the current app.
