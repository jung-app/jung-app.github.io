# Synthetic browser QA, 2026-09-05

Run `npm run preview`, then open localhost port 8765. The server binds only to
127.0.0.1 and uses synthetic data, a Telegram stub and same-origin fixture API.
No production data, external font request or live checkout is used.

Browser DOM checks covered widths 320, 390 and 1280, light/dark themes, no horizontal
overflow, draft preservation across background refresh and cancellation, negative
conversation feedback, error recovery and plan-specific recurring terms. Images are
browser-generated JPEGs. Full-page captures preserve the responsive layout; the
1280 path capture is a viewport capture. Font is the system fallback.

This does not establish native Telegram iOS/Android behavior, real payments,
screen-reader conformance, clinical benefit or conversion uplift.
