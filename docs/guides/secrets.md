# Secrets inventory

Every secret AlumniKonneQt uses, where it lives and how to replace it. This file holds names only. Never write a value here, in an issue, in a commit or in chat.

Last checked: 23 November 2026, during the launch review (`docs/verification/security-review-2026-11-22.md`).

## Rules

- A secret never carries the `NEXT_PUBLIC_` prefix. Anything with that prefix is sent to every browser.
- Production secrets are set in Vercel for the Production environment only, unless the table says otherwise.
- If a secret is ever committed, pasted into a chat or shown on a screen share, rotate it. Deleting the commit is not enough.
- After rotating, redeploy production and run the hosted check in `docs/verification/hosted-demo.md`.

## Secrets

| Name | What it unlocks | Where it lives | How to rotate |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access that bypasses row-level security | Vercel (Production only, verified), `.env.local` for the dev database | Supabase dashboard, Project Settings, API keys: create a new secret key, update Vercel, redeploy, then revoke the old key |
| `RESEND_API_KEY` | Sending email as the project domain | Vercel, Supabase Auth SMTP settings | Resend dashboard, API keys: create a new key named `alumnikonneqt-website-production`, update both places, delete the old key |
| `RESEND_WEBHOOK_SECRET` | Proves a delivery webhook came from Resend | Vercel, Resend webhook settings | Resend dashboard, Webhooks: roll the signing secret, update Vercel, redeploy |
| `NOTIFICATION_WORKER_SECRET` | Calling `POST /api/notifications/process` | Vercel, GitHub Actions secret used by `notification-emails.yml` | Generate a new random value (32 bytes or more), update Vercel and the GitHub secret together, redeploy |
| `DEMO_SWITCHER_KEY` | Unlocking the presenter account switcher at `/demo` | Vercel, only while `DEMO_SWITCHER_ENABLED` is true | Generate a new value of 16 characters or more and update Vercel. Clear it and set the flag to false after a demonstration |
| `SENTRY_AUTH_TOKEN` | Uploading source maps to Sentry at build time | Vercel, set by the Sentry integration (present in every environment, verified) | Sentry, Settings, Auth Tokens: revoke, then reconnect the Vercel integration |
| Google OAuth client secret | Google sign-in | Supabase dashboard, Auth, Providers. Locally `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` in the shell that starts Supabase | Google Cloud console, Credentials: add a new secret, update Supabase, delete the old secret |
| Cloudflare Turnstile secret key | Verifying bot checks on sign-in, sign-up and password reset | Supabase dashboard, Auth, Attack Protection. It is never set in this app | Cloudflare dashboard, Turnstile: rotate the secret key, update Supabase |
| Supabase database password | Direct Postgres connections | Supabase dashboard only. The app does not use it | Supabase dashboard, Project Settings, Database: reset the password |
| Hosted demo account passwords | Signing in as the fictional demonstration accounts | `.env.hosted-demo-access.json` on the development machine, ignored by git | Follow `docs/guides/demo-mode.md` and `docs/verification/hosted-demo.md` |

## Public values (not secrets)

These are safe in the browser and need no rotation: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`. The anon key is only safe because row-level security is enforced on every table; the database tests in `supabase/tests/` check that.

## Known gaps

- Preview and Development environments in Vercel use the production Supabase URL and anon key. Previews sit behind Vercel sign-in. Accepted on 23 November 2026; a separate preview database would remove the overlap.
- The Vercel scopes of `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NOTIFICATION_WORKER_SECRET` and `DEMO_SWITCHER_KEY` were not individually confirmed in the review. Check with `vercel env ls` and keep them Production only.
