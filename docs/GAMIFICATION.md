# Journey and progress

Journey is optional reflection on real work. Home prioritizes actions; `/journey` contains levels, companions, contextual steps, weekly intentions, activity rhythm, milestones and 12 achievements. Its visibility preference hides workspace progress and celebrations. Recording continues when hidden. Core work is never gated. Recording an application does not send anything to an employer.

## Reward rules

| Action | XP | Rewarded actions per UTC day |
| --- | ---: | ---: |
| Application submitted | 30 | 5 |
| Contact added | 10 | 5 |
| Interview scheduled | 25 | 4 |
| Interview prepared | 40 | 3 |
| Interview completed | 60 | 3 |
| Follow-up completed | 25 | 5 |
| Task completed | 15 | 5 |

An application record represents an already submitted application; unsent opportunities belong in Saved. Saved-job conversion also counts. Saving jobs, viewing pages, ordinary edits, status changes, notes and imports do not award XP. Preparation requires at least one topic, every topic checked, and nonblank questions to ask. Interview completion requires the explicit `Completed` outcome, not a past date. Tasks can be personal or application-linked. Follow-ups earn once per opportunity, not every reschedule.

Daily limits never block work. Above-limit events receive zero XP and cannot be retried tomorrow for credit. Quests use their underlying action reward without a second bonus. Weekly intentions have no bonus or penalty: they count distinct live submissions, including above-limit submissions, in the Monday–Sunday UTC week against the existing user goal. Analytics separately counts application dates including imported records.

## Authority and integrity

Migration `005_journey_trigger_integrity.sql` upgrades the two central triggers for databases opened by the development watcher during rollout. Explicit `ON CONFLICT DO NOTHING` preserves idempotency when a reward fires inside the preparation repository's outer UPSERT. It changes no existing XP, preferences or achievements and does not replay backfill. The migration regression test exercises this upgrade and verifies preserved progress.

Migration `004_journey.sql` creates:

- `user_progress`: companion, workspace visibility, internal import suppression flag.
- `reward_rules`: canonical reward amounts and daily limits.
- `reward_events`: owner, type, entity ID, semantic fingerprint, XP, source and database timestamp.
- `user_achievements`: durable unlock ID, recognition timestamp and source.

Domain-table triggers submit candidates to an internal SQLite view. One INSTEAD OF INSERT trigger applies rules; a ledger trigger evaluates achievements. These execute inside the original domain transaction, including legacy fields and saved-job conversion. Failure rolls back both the work and its rewards. Explicit `ON CONFLICT DO NOTHING` matters: outer preparation UPSERTs must not override nested conflict handling.

Uniqueness is both `(userId,type,entityId)` and `(userId,type,fingerprint)`. Reopening/editing/rechecking the same entity cannot earn again. Fingerprints identify recreated applications by company + role, contacts by name + email + company, tasks by application + title, interviews by application + type + scheduled time, and follow-ups by company + role. Input fields are trimmed; fingerprints are lowercased. Tombstones survive deletion. Daily caps bound simple creation farming. User-editable dates never control reward day boundaries.

`GET /api/journey` reads only the authenticated session owner's aggregate. `PATCH /api/journey/preferences` strictly accepts only `companion` and `enabled`. Client owner, XP, achievement and event claims are rejected; there is no grant/claim endpoint. Reads generate neither rewards nor unlocks. Existing prepared statements, authenticated writes, origin validation and version conflicts remain in effect.

AppLayout owns one shared Journey resource and one Overview resource. Home/Journey/Today/Analytics consume contexts instead of issuing duplicate requests. Existing mutation invalidation and authenticated refresh update them; owner-keyed requests discard late responses after logout. Reward history is capped at 12 API entries. Aggregates use owner/type/time indexes. Next tasks use one grouped query per application collection, not one request per row.

## Existing users, reset and backup

Migration backfills current evidence once before installing live triggers: applications, contacts, noncancelled interview scheduling, completed interviews/tasks/follow-ups and fully checked preparation with questions. Deleted records or inferred histories are not invented. Original timestamps are evidence timestamps; interview/preparation `updatedAt` is **not a claim about the exact completion time**. `source=backfill` never counts toward live streaks or weekly intentions. Achievements record migration-time recognition. Semantic deduplication applies, but today's reward cap does not limit old work.

Old demo records cannot reliably be distinguished from user-entered records. Newly loaded demo data and ordinary imports are suppressed in the replacement transaction. Zero-XP import tombstones prevent reopening already completed imported work from claiming it again. A genuinely new transition can earn its own reward. Reset/clear/import retain progress and preferences; deleting career records cannot reset anti-abuse history.

Version 4 JSON remains a portable career-data backup, not a signed reward backup. XP, preferences and achievements are not imported from editable JSON. Preserve the complete trusted account through a consistent SQLite backup: stop the server before copying the database, or use SQLite backup facilities. Do not copy just the main database file during WAL writes.

## Levels and companions

Level 1 begins at zero and needs 100 XP. Each subsequent interval grows by 50: 100, 150, 200, 250, etc. `levelFor` derives progress from the authoritative total. Level 5 starts at 700 XP, level 10 at 2,700, level 20 at 10,450. No leaderboards, resets or premium currency.

Ember (fox), Pip (cat) and Clover (hare) are original inline SVG characters, available immediately. They gain a scarf at level 5, compass at 10 and travelling hat at 20. No downloaded illustration assets or animation library. The companion represents progress and requires no care tasks.

Twelve achievements cover first/10/50 submissions, scheduled interview, full preparation, first/10 completed interviews, first/5 contacts, first/10 follow-ups and 10 completed tasks. Counts use credited events including backfill. Definitions in `src/domain/journey.ts` correspond to the migration's transaction rules; future rule changes require a new migration. Milestones use a separate checkpoint route for 10 applications, 5 connections and 10 completed interviews.

One nonblocking dismissible toast consolidates feedback: level-up, otherwise achievement, otherwise XP. Loading a session establishes a baseline without celebrating historical rewards. There are no blocking level-up modals. Reduced-motion preferences disable transitions.

## Contextual steps and activity

Suggestions use actual data: up to two interviews in the next seven days needing preparation, two due/overdue follow-ups and two open tasks ordered by urgency/priority. With none, an actual saved opportunity can be suggested. No fake daily quota is generated. Up to three receipts show today's completed rewarded tasks/preparation/follow-ups. Links open the underlying work, without a claim button or separate mutable quest table.

Preparation suggestions evaluate the current checklist, so reopening it can surface the work again without a second reward. Archived opportunities are omitted. Streaks use distinct UTC dates with positive live rewards, allowing yesterday as an unbroken current streak. Gaps end only the streak; total active days, XP and achievements remain. Calendar independently uses the browser timezone.

## Limits and testing

This is a personal local tool, not fraud-proof competition: external submissions and task quality cannot be verified. Different spellings/new parent IDs can bypass semantic deduplication; daily caps still apply. Legitimate reapplication to the same company/role or repeated follow-up earns once, while the work remains unrestricted. Quests are current suggestions/receipts, not a historical archive. The append-only ledger grows with lifetime activity. No paid service, jobs or deployment is introduced.

Tests cover awards, duplicate prevention, caps, rollback, parallel HTTP submissions, owner isolation, preparation criteria, reopening, import suppression, levels/evolution, streaks and migration persistence. Browser coverage includes registration, submission, tasks/interview completion, achievements, companion choice, opt-out, refresh and sign-in persistence.
