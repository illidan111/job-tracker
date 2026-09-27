# Career CRM: current system and implementation decisions

Inspected at `7558212` on 2026-09-27, before this cycle's code changes.

## What exists

React Router lazy-loads screens; Zustand owns the authenticated workspace and serializes writes. Shared Zod validation sits between forms, Express routes and SQLite. Password hashing, rate-limited authentication, opaque HttpOnly sessions, same-origin writes, prepared queries and user-scoped relations are already real implementations. Migration files are applied transactionally. No production feature is mocked; demo data is explicitly opt-in.

Applications have reusable contacts/tags, multiple interviews, a persisted activity trail, one follow-up, saved-job conversion, archive/recovery, combined URL filters, bulk operations and version conflicts. JSON backups include applications and saved jobs. Existing automated checks cover these paths, including account isolation and failure recovery.

## Gaps and fragile areas

- Companies are repeated strings. There is no company relationship view or reusable research.
- There are no tasks, contextual checklists, structured materials, individual notes or dedicated interview preparation.
- Dates are scattered across overview widgets; there is no unified agenda/calendar.
- Command search only finds navigation commands.
- Workspace reads hydrate every application and its nested history; ordinary record writes then fetch the entire workspace. Table pagination only limits rendering.
- The root error boundary is the only render boundary. Some forms are compressed and duplicate presentation patterns.
- Archive is reversible, but delete is permanent. A new generic trash system would add complexity without solving the main daily workflow.

## Chosen scope

Add a small career domain module with reusable companies, versioned tasks, application notes/materials and interview preparation. Reuse tasks for preparation/take-home deadlines and checklists. Today and a month calendar share one schedule projection. Extend the existing command palette with grouped, bounded global search. Preserve auth, Kanban status semantics, follow-up semantics and the visual system.

New collections are loaded contextually through bounded APIs rather than nested into bootstrap. Existing list loading now uses server pagination and compact reports; bootstrap and post-mutation refreshes are bounded. Backups must include new entities and remap their relationships atomically. No cloud integration, scraping, uploaded-file storage, PWA, offline queue, resume builder or speculative AI is introduced. Existing archive/recovery is retained instead of a second deletion model.
