# Automated accessibility checks

The accessibility check (issue #146) loads the main pages in a real browser, in the light theme and the dark theme, and runs two tests on each:

- **axe-core** (`@axe-core/playwright`, every rule axe ships), which covers names, labels, landmarks, ARIA use, text contrast and similar checks.
- **Control border contrast**, a check of our own for WCAG 1.4.11 (non-text contrast), which axe does not test. Every visible text field, text area, select and combobox must have a boundary (its border, or its fill) of at least 3:1 against the colour around it. The check reads computed colours, so it handles `oklch` and `color-mix` tokens. It ignores background images and gradients, so a field over a photograph is measured against the solid colour beneath the image.

Serious and critical findings fail the run. Moderate and minor findings are recorded in the results file but do not fail it.

## What it covers

| Account | Pages |
| --- | --- |
| Visitor | Landing page (with the cookie banner open, then with it dismissed), about the developer, sign in, sign up, reset password, privacy |
| New account | Arrival screen after sign-up |
| Member (Mentee) | Discover (default view, keyword results as passes and as a list), profile, email preferences, requests (one pending request and one accepted connection) |
| Mentor | Discover, profile, requests (one incoming request) |
| Administrator | Admin (with one pending report) |

Each page is checked in both themes. The run sets the stored cookie choices (functional storage allowed, analytics declined) and the stored theme before loading each page, then confirms the page really shows that theme. It runs with reduced motion so entrance animations have settled before colours are measured.

## Running it

### Public pages, on any machine

Needs a production build and no database:

```bash
npm run build
npm run start
# in a second terminal
npm run test:a11y
```

`A11Y_APP_URL` points it at another local port (loopback only), and `A11Y_RESULTS` changes where the results file is written (default `/tmp/accessibility-results.json`).

### Everything, in CI

The **Accessibility checks** job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `npm run test:a11y:full` (`scripts/run-accessibility.mjs`) on every pull request and push to `main`. Like the cold-start journey, it starts a disposable Supabase stack on the runner on its own ports (56421 to 56429), builds the app against it, signs up four fictional accounts in the browser, adds fictional profile details, two requests and one report with the service role, promotes one account to administrator, and has a Mentor accept a request in the browser. It deletes the accounts and stops the stack afterwards. The results file is kept as the `accessibility-results` artifact for 14 days.

The full run needs Docker. On the maintainer's Mac the development database lives on the Azure VM, so do not run `test:a11y:full` there: rely on the CI job.

## When it fails

The log lists each finding with the account, page, theme, rule and up to five affected elements, and the results file has the detail.

- Fix it, or
- if it cannot be fixed in the same change, open a GitHub issue for it and add an entry to [`scripts/accessibility-known-issues.json`](../../scripts/accessibility-known-issues.json):

```json
{ "page": "/requests", "rule": "color-contrast", "issue": 123, "theme": "dark", "account": "member" }
```

`theme` and `account` are optional and narrow the entry. A listed finding is still reported, marked with its issue, but no longer fails the run. Remove the entry when the issue is fixed.
