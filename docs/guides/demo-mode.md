# Demo mode for presentations

Demo mode lets a presenter move between the fictional demo Mentee and demo Mentors in one click, so an audience can see a mentorship request from both sides: sent by the Mentee, received and accepted by the Mentor, then the shared connection.

Only accounts created as fictional fixtures (`app_metadata.fictional = true`) can be reached. Real member accounts, and staff accounts, cannot be reached, whatever the browser sends.

## Settings

| Variable | Purpose |
| --- | --- |
| `DEMO_SWITCHER_ENABLED` | Must be `true` for demo mode to exist. |
| `DEMO_SWITCHER_KEY` | Presenter key, at least 16 characters. Without it demo mode stays off. It must be random, because guesses are not rate limited: generate one with `openssl rand -base64 24` and keep it out of chats, slides and screenshots. |

Both are server only. Changing them on Vercel needs a redeploy to take effect.

## Before the presentation

1. Set both variables and redeploy (or restart the local dev server).
2. Open `/demo` in the presenting browser and enter the presenter key. This unlocks demo mode in that browser for 12 hours. Other visitors see nothing.
3. Go to `/login`. A **Demo mode** panel lists the demo accounts. Choose the demo Mentee.

## During the presentation

- The **Demo mode** bar at the top of every workspace page shows who you are signed in as and switches to any other demo account, keeping you on the same page.
- A suggested flow: as the Mentee, send a request from Discover. Switch to the Mentor on the Requests page, accept it, then switch back to show the connection and its next steps.

## Afterwards

1. Select **End demo mode** in the bar (or on `/demo`) to remove the presenter cookie from the browser.
2. Sign every demo account out on all devices, so nobody keeps a demo session after the event:

   ```bash
   node --env-file=.env.local scripts/end-demo-sessions.mjs
   ```

   ```bash
   node --env-file=.env.local scripts/end-demo-sessions.mjs --apply
   ```

   The first command is a dry run that lists the accounts. Point the environment file at the hosted project to clean up the live site. Sessions can no longer be refreshed after this, but an access token already issued stays valid until it expires (one hour by default).
3. Set `DEMO_SWITCHER_ENABLED=false` and redeploy if demo mode is no longer needed.
4. If the presenter key may have been seen, rotate `DEMO_SWITCHER_KEY`. Changing the key locks out every browser that was unlocked with the old one.

## Demo accounts and real members are kept apart

Demo accounts share the live database with real members, but the database keeps the two apart once migration `20261124120000_separate_demo_and_member_accounts.sql` is applied:

- A mentorship request, and therefore a connection, can only join two demo accounts or two real members. The database refuses a request in either direction between a demo account and a real member, whoever sends it, and the app shows "Demo accounts and members cannot send requests to each other."
- Discovery offers each account only Mentors of its own kind: Recommended, Keyword search and the model comparison. Real members do not see demo Mentors, and the demo Mentee does not see real Mentors.
- Cross requests and connections created before the migration are left in place. A pending cross request can still be cancelled or declined, but accepting it is refused.
- On a site where every Mentor is a demo account, a newly registered real member sees no Mentors at all. Present with the demo accounts, not with a freshly registered one.

An account counts as a demo account only when its `app_metadata.fictional` is `true`. Test accounts that must interact with demo accounts (for example in a study or a load test) need the same marker, and accounts that must interact with real members must not have it.
