# Step control QA, 2026-09-06

Run `~/jung-bot/.venv/bin/python -m tests.preview_experiment` from `~/jung-bot`,
then `npm run preview` from `~/jung-app`. Both listeners bind to 127.0.0.1.

Open `http://127.0.0.1:8765/?state=step&theme=light`. The Mini App uses the real
local API and a synthetic in-memory profile. The adapter bypasses Telegram auth
only in this manually launched test process. It never loads production profiles.
`state=step-offline` injects POST 503; `state=step-conflict` injects POST 409.
`/admin-preview?state=admin&theme=light` uses explicitly fictional aggregate counts.
Restart the backend adapter with `--controls-disabled` to verify the fallback UI.

Observed in Chrome: check-in (all three answers), correction, explicit edit/save,
pause/resume, cancellation, draft preservation across refresh and tab navigation,
offline recovery and stale revision feedback. Widths 320, 390 and 1280; light/dark;
no horizontal overflow or application JavaScript errors on checked views. Fonts use
the system fallback. Screenshots are browser captures, not generated mockups.

Files include the small-screen offline form, admin outcome labels, desktop step,
dark step and dark corrected result. API regressions additionally cover real stale
write rejection, concurrent requests and delayed extraction in both worker paths.
`editor-clock-320-dark.png` shows optional dates and the device-clock notice; saving
the changed date was verified against the real local API.
`controls-disabled-320-light.png` shows the fallback card after disabling controls
on the actual local backend. The new editor is absent, and the chat action remains.

Not established: native Telegram iOS/Android, screen-reader conformance, 200% text
zoom, live model safety, clinical benefit, retention uplift or production payments.

Known rollout detail: backend JSON Schema must continue accepting `user_updated_at`
after users edit a step. Roll back with a compatible backend or disable the new UI
while retaining the schema and guard; an old strict validator rejects the new field.
`EXPERIMENT_CONTROLS_ENABLED=false` hides controls in profile responses and rejects
control writes with 503, while preserving readable plans and the chat path.
