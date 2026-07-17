# ProDigital website

Static website for ProDigital marketing agency.

This repository also contains **Agency OS** — the agency's internal
management system (dashboard, tasks, projects, clients, KPI). It lives in
[`agency-os/`](agency-os/) and has its own README with setup and deploy
instructions.

## Pages

- `index.html` - main page
- `cases-target.html` - targeted advertising cases
- `cases-context.html` - contextual advertising cases
- `404.html` - not found page

## Deploy

Use this directory as the publish root. All required images are stored in `assets/`.

Form submissions are sent to Google Sheets through Google Apps Script. Paste the deployed web app URL into `GOOGLE_SHEETS_WEB_APP_URL` in `script.js`.
