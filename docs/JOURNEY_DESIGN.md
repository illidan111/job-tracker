# Journey design diagnosis

## Before implementation — 27 September 2026

Reviewed the running application in Edge against an isolated SQLite database: populated and empty Overview, Applications, Kanban, application detail, Analytics, Calendar, Tasks, Companies, Contacts, Settings, application form and 375 px navigation. Browser connector initialization failed; the repository's Playwright/Edge runtime provided real browser captures instead. No production/user database was modified.

Observed problems:
- Overview makes a giant application count the focal point. Follow-ups and interviews compete with historical charts; mobile buries actionable work under counters.
- Applications has an actual layout defect: selection/column grid rules collide, pushing company content right and overlapping location with status. Salary occupies space that should explain the next action.
- Detail splits next steps across a small sidebar, follow-up panel and interviews. Most facts have equal weight inside separate boxes.
- Analytics duplicates Overview's charts and surrounds simple comparisons with large containers.
- Tasks, contacts and company directories inherit card framing even where a continuous list would read better. Empty screens feel abandoned; empty Overview still renders two charts.
- Calendar's date grid is useful but every day appears as a separate card.
- Ten equally weighted navigation links mix work, network and reporting. The mobile dialog simply repeats the desktop hierarchy.
- Forms are functional and their grouping is useful; preserve their validation and draft protection. Preserve status labels and non-drag Kanban controls.

## Direction

Warm paper, ink and fired-clay accent. Native system typography; large editorial headings, compact readable metadata, tabular numbers. A fine route with checkpoints communicates continuity. Avoid a literal map and animated scenery. Meaningful semantic colors remain distinct from the brand accent.

Home becomes a personal briefing: real-state introduction, next actions, a compact pipeline route, recent activity. Journey is a single composed progress landscape with a quiet vector companion, level marker, contextual steps and an achievement ledger. No collection of XP/pet/streak cards. Core work stays fully usable independently.

Navigation groups Home/Today, Work, Network and Perspective; mobile gets persistent Home/Work/Journey/More destinations. Applications becomes a compact opportunity list with next action and last activity. Detail brings next action above factual sections. Existing routes, filtering, bulk selection, editing and accessibility contracts remain.

Implementation verification will include live browser review and iteration, light/dark responsive coverage, keyboard/axe checks, backend integrity and persistence workflows. Screenshots are inspection artifacts under ignored data/test-results, not shipped assets.

## Rendered design review

Reviewed the resulting Home, Applications, Kanban, detail, Journey, Analytics, Calendar, Tasks, Companies, Contacts, Settings, empty Home, form and mobile navigation in real Edge. Inspected the screenshots, including Journey at 320/390/430 px and dark mode. Iterated after inspection: moved detail's next action above its tabs; reduced Home's introductory text and vertical spacing so the companion remains visible on mobile; removed the duplicate Home add button; flattened Analytics and directory framing; replaced the unstable opt-out checkbox with the existing accessible switch pattern.

Home now leads with a personal briefing and three useful actions, an integrated companion and a four-stop pipeline. Applications uses aligned opportunity rows rather than overlapping table columns. Journey has one composed landscape, a route of checkpoints and a restrained achievement ledger. The fox, cat and hare are original inline vectors with consistent geometry and progression accessories; they do not require downloads or constant animation. Dark mode retains warm surfaces and a readable clay accent. Mobile has its own persistent destinations and retains the existing full navigation dialog for secondary work.

Automated viewport checks cover 320, 375, 390, 430, 768, 1024, 1440 and 1920 px in both themes. Axe, keyboard dialogs/navigation, non-drag status controls and reduced-motion behavior were exercised. Manual screen-reader and non-Chromium browser reviews remain outstanding; screenshots and automated checks are not a claim of those reviews. See [Verification](VERIFICATION.md) for the exact test results.
