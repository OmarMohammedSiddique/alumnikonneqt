# README images

- `readme-landing.jpg`: screenshot of the landing page hero, shown at the top of the repository README.
- `readme-walkthrough.gif`: animated walkthrough of the landing page (cabin intro, window shade, hero and main sections), shown under the screenshot.

Both are captured from the project's own landing page by `scripts/capture-readme-preview.mjs` (issue 155), at a 1440 by 900 viewport in light mode, with non-essential cookies rejected. The current pair was captured from https://alumnikonneqt.com on 24 November 2026, after pull request 154 was deployed. They contain only the site's own interface and the illustrative example profile shown on it, not member data. Recapture them after visible changes to the landing page:

```bash
node scripts/capture-readme-preview.mjs
```

Pass a base URL such as `http://localhost:3000` to capture a local server instead of the live site.
