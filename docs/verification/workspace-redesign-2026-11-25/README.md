# Workspace redesign screenshots (25 November 2026)

Before and after screenshots for issue #160, which gives the signed-in workspace the window seat look of the landing page and sign-in.

## How they were taken

- Local development server on `http://127.0.0.1:3160`, against the development database on the Azure VM. No live site was used.
- Fictional local seed accounts only: the demo Mentee "Career Explorer" and the demo Mentor "Grace Wanjiku" from `scripts/seed-dev.mjs`, and the local administrator `admin@seed.local`.
- Captured with `node --env-file=.env.local scripts/capture-workspace-screens.mjs <folder>`: full-page JPEGs at 390 and 1440 pixels wide, in light and dark mode, with reduced motion. They were recompressed afterwards with ffmpeg (`-q:v 11`) to keep both folders near 8 MB.
- `before/` is `main` at `1ea56fc`, captured before any change on the branch. The later main commits #161 to #163 do not touch the workspace interface. `after/` is the branch head.
- The capture reported no horizontal overflow on any page in either set.
- Later on 25 November 2026 the profile, profile picture, email preferences and requests pages changed to use the full width of wide screens (two columns from 1024 pixels, one column on phones and tablets). Their 20 `after/` files (`mentee-profile*`, `mentee-requests*` and `mentor-requests*`) were captured again the same way, from a development server on port 3060, and the rest of `after/` is unchanged.

Two differences come from the capture, not the design:

- The `before/` frames show the round Next.js development badge in the lower left corner. The `after/` run hides it.
- Full-page captures draw sticky elements once at the top. In `before/` the sidebar therefore stops after the first screen; in the browser it stays in view.

## Files

Each name is `<account>-<page>-<width>-<theme>.jpg`, in both folders.

| Page | Account | State |
| --- | --- | --- |
| `mentee-discover-loading` | Mentee | Discover while the model comparison runs (loading state) |
| `mentee-discover-compare` | Mentee | Discover, default comparison view with Mentor passes |
| `mentee-discover-recommended-list` | Mentee | Discover, Recommended mode as a list with filters |
| `mentee-profile` | Mentee | Profile form, privacy and blocked members |
| `mentee-profile-photo` | Mentee | Profile picture page |
| `mentee-profile-email-preferences` | Mentee | Email preferences |
| `mentee-requests` | Mentee | Requests with an accepted request and a connection |
| `mentor-requests` | Mentor | Incoming requests and connections |
| `admin-admin` | Administrator | User management, safety reports and audit log tables |
| `admin-discover-empty` | Administrator | Discover empty state for a profile without a match profile |
| `admin-requests-empty` | Administrator | Requests and connections empty states |

Widths: `390` (phone) and `1440` (desktop). Themes: `light` and `dark`. That is 44 files per folder.

## Not captured

- The route error state (`app/(dashboard)/error.tsx`) cannot be reached without breaking a page on purpose. It uses the same tokens, buttons and status message as the pages above.
- The open phone menu is checked by `scripts/verify-accessibility.mjs` (open, one Sign out button, Escape closes it and returns focus) rather than captured here.
