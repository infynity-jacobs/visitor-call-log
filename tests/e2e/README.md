# End-to-end tests

Placeholder for browser-driven end-to-end tests. See `tests/README.md` for what
this should eventually cover.

No E2E framework is wired up yet. To add one:

1. `npm install --save-dev @playwright/test` (or Cypress) in `app/frontend`
2. Add a config pointing at the dev server (`npm run dev`) or a built preview
   (`npm run preview`)
3. Add specs here, e.g. `visitor-register.spec.js`, `reports.spec.js`
