# Movement QA, September 10 and 12, 2026

Use the backend `python -m tests.preview_experiment --movement-history` from
its test environment and `npm run preview` here. Both bind only to loopback.
`http://127.0.0.1:8765/?state=step&theme=light#movement` talks to the real local
aiohttp API with an in-memory synthetic profile. No production profiles, chat
content, Telegram tokens or model calls are involved.

Observed in Chrome at 320 and 390 CSS pixels, light and dark themes:

- Choose a walk with optional starting energy and explicit step replacement;
  the existing step editor remains available in the same flow.
- Pain/unwell selection allows rest only and is not saved. Rest pauses a linked
  movement step. A completed report is an attempt, not evidence of benefit.
- Correct completion, energy and effect including worse/same/unknown. Correct a
  past report while paused without resuming the plan or its reminders.
- Delete the linked entry and its step, enable then disable personalization,
  clear the journal and preferences, show honest empty/insufficient history.
- Preserve a draft across refresh, section switching and collapsing; explicit
  cancellation resets it. POST 503 (`state=step-offline`) retains the draft on
  retry; POST 409 (`state=step-conflict`) requires reviewing the current step.
- Six paired synthetic reports show 4 higher, 1 same, 1 lower, a visible denominator,
  comparability rules and a non-causal explanation. Chosen duration is not measured
  activity time. Changing a report changes the personal observation.
- Restart the backend with `--movement-history --movement-disabled`: no new choice,
  records remain visible and correction can still be saved to the actual API.
- `/admin-preview?state=admin&theme=light` shows first enum reports with honest labels.
  All figures there are fictional or empty, not production business metrics.

Checked views have no horizontal overflow or application console errors. The
screenshots are actual browser captures. `observations-320-dark.png` was recaptured
September 12; files retain the first QA folder date. `movement-390-light.png` shows
the integrated main action; empty, conflict and offline screenshots show the
relevant fallback states. Disabled controls and the admin view were checked through
the visible DOM; their incomplete captures are omitted. API regression tests cover
auth and real concurrency.

Not verified: native Telegram iOS/Android, a screen reader, clinical effectiveness,
retention, real payments or real model safety. First-answer analytics are separate
from the corrected personal journal and cannot prove benefit or unique-user reach.

Recovery: `MOVEMENT_ENABLED=false` on the backend hides new choices while preserving
data controls. The compatible rollback backend is `cff7d34` (backend PR #50), which
accepts and exports the journal. Keep the migration and schema on rollback.
