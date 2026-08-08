# Repository guide

## Purpose

This repository is the static landing site and Telegram Mini App frontend for Jung Bot, published through GitHub Pages.

## Source of truth

- `index.html`, `app.js`, and the linked styles own the Mini App.
- `landing.html`, `landing.js`, and landing styles own the public landing page.
- `root-redirect.js` owns root routing.
- `tests/` owns browserless smoke coverage.
- Product context lives in `/Users/ruslanfomin/iishenka/Projects/jung-bot/`.

## Rules

- Keep production API and Telegram bot identifiers centralized in the existing configuration path.
- Preserve safe root redirects, Telegram WebApp behavior, responsive layout, accessible names, and keyboard use.
- Never add credentials or private user data to this public repository.
- Preserve unrelated work in the dirty tree and make focused edits.
- Treat production publishing as an external mutation. Do not push or deploy unless explicitly requested.

## Verification

Run `npm test` after changes. For visible UI changes, also check the relevant page at a narrow mobile viewport with no console errors or horizontal overflow.
