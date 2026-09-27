# Engineering audit — 2026-09-27

## Starting point

Audited the existing `main` branch at `9ff5cbe` with a clean working tree. The earlier full-stack work was already implemented: React/Vite with lazy React Router pages, Zustand workspace state, shared Zod validation, Express, Node SQLite, a versioned migration runner and HTTP/browser tests. This pass extends that architecture rather than rebuilding it.

## What persists and what is sample data

- Accounts, hashed server sessions, profiles, weekly goals, applications, notes, tags, contacts, interviews, timelines and reminders persist in SQLite. Every resource query is scoped by the authenticated user; composite foreign keys prevent linking another user's records.
- Dashboard, goals and analytics derive from saved application data. Filtering and pagination operate on the complete bounded workspace in memory, not just the visible table page. This remains appropriate for the documented local-product scope.
- The optional 24-record sample workspace is generated only by an explicit Settings action or the configured CLI seed. New accounts start empty.
- LocalStorage is only an explicit legacy import source. Navigation, open dialogs, search controls and unsaved drafts are transient frontend state.
- Existing CSS, layout, responsive navigation, accessible native dialogs, drag-and-drop, import/export, relational schema and authentication architecture were retained.

## Findings and changes

| Finding | Change and regression coverage |
| --- | --- |
| `data/` ignored the required `src/data/demo.ts`, so a clone lacked imported source | Anchor the ignore rule to `/data/` and include the existing sample generator in Git |
| The application form could insert a 101st interview, then fail response validation after committing it | Enforce the limit in the shared insert operation; API test verifies 422 and complete rollback |
| Relinking the same contact created duplicate activity and unnecessary versions | Treat the existing link as a no-op; HTTP regression test |
| Reminder refresh errors were swallowed; a 401 after a write or conflict could leave private state visible | Preserve successful saves, surface refresh errors, and clear private state on 401; store and browser recovery tests |
| Removing a completed interview could reduce historical conversion | Count retained completed-interview events; domain regression test |
| Future application dates inflated monthly progress | Bound month-to-date counts at today's local calendar date; tests around Sunday/Monday and month boundaries |
| Empty accounts showed apparently meaningful `0%` conversions | Show unavailable rates and a direct Add application action; browser test |
| Fractional pagination query values produced partial pages and fractional page labels | Normalize invalid page values; browser checks for fractional, infinite, negative and nonnumeric values |
| Follow-up validation could leave its invalid field collapsed | Include follow-up errors in the form's automatic section expansion |
| Board controls allowed additional changes while a save was pending | Disable drag initiation and status menus during the existing serialized mutation |
| Automatic Tailwind discovery produced additional utilities in a source copy without Git metadata | Explicitly scan `src/` and `index.html`; clean-copy CSS shrank from 111.80 kB to 71.02 kB and build time returned from 7.44 s to about 1 s |

The CSS source scope follows [Tailwind's documented explicit source configuration](https://tailwindcss.com/docs/detecting-classes-in-source-files). It retains the existing component styles and avoids scanning unrelated project artifacts.

## Security review

Reviewed password hashing, session storage/rotation/expiry, Origin checks, JSON requirements, ownership enforcement, bound SQL parameters, URL validation, imports, environment configuration and Git exclusions. Existing scrypt password hashes and hashed session tokens remain server-only. No real credentials or database files were added to source control.

Extended HTTP coverage for unauthenticated workspace operations, invalid weekly goals, client-supplied owner IDs, missing/malformed resource IDs, and transaction rollback. Existing tests cover registration/login, duplicate accounts, rate limits, foreign-user CRUD/relation access, CSRF, invalid input, import isolation, and session revocation.

## Scope

No schema change was necessary; migrations and existing data remain compatible. No deployment, hosted service or paid infrastructure was introduced. Notes remain a validated per-application text field edited with the application form, and tags reuse the existing per-user relational model. See the README for deliberate hosting and scale limits, and [Verification](VERIFICATION.md) for actual execution results.
