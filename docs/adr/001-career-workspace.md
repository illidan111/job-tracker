# Career entities and bounded workspace queries

Status: accepted, 2026-09-27.

## Context

Applications already normalize contacts, interviews and tags. Company names remain duplicated strings, and preparation and next steps compete inside one notes field. Bootstrap hydrates the whole workspace and ordinary saves refetch it. Adding more nested records would multiply this cost.

## Decision

Add reusable account-owned companies, optional application tasks, individual notes, structured materials and interview preparation. Keep the existing application company string as a compatibility field; application creation/editing resolves the company relation, and company rename updates linked application names atomically. Company names are unique within each account, ignoring ASCII case, consistent with SQLite NOCASE.

Use tasks as application checklists and preparation/take-home deadlines. Keep interview scheduling outcome separate from the user's subjective reflection. Keep documents as text and validated HTTP(S) links; do not introduce upload storage or a resume editor.

Load these resources only where needed. Paginate application lists, board columns, companies, contacts, saved jobs, notes, tasks, notifications and activity on the server. Report aggregates independently of the browser cache. Today and calendar use the same date projection, converting interview instants through the requested IANA timezone.

Use version conflicts for edits, request IDs for new tasks/notes, transactions for linked writes and full-backup restoration, and composite owner foreign keys. Extend JSON backups to version 4 with explicit relationship remapping. Retain archive/restore for application recovery; do not add a parallel trash model.

## Consequences

No new runtime dependency or service. More APIs, but small response contracts and a shared abortable query hook keep the frontend understandable. Invalidating active queries refreshes counts, calendar, search and lists; record saves no longer fetch the entire application corpus. Bootstrap remains a bounded compatibility cache for existing forms.

Analytics scan compact facts on the local API host; schedule merges selected date ranges before returning a page. This is suitable for a personal workspace, not a claim of constant-time analytics at enterprise scale. Full exports intentionally include all retained data and can exceed the 5 MB import limit. Company merges, persistent recent-item history, saved filter presets, favorites, PWA/offline writes and background message delivery are deferred.
