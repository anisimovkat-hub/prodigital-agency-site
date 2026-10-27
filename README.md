# ProDigital website

Static website for ProDigital marketing agency.

## Pages

- `index.html` - main page
- `cases-target.html` - targeted advertising cases
- `cases-context.html` - contextual advertising cases
- `404.html` - not found page

## Deploy

Use this directory as the publish root. All required images are stored in `assets/`.

Form submissions are sent to Google Sheets through Google Apps Script. Paste the deployed web app URL into `GOOGLE_SHEETS_WEB_APP_URL` in `script.js`.

## SEO / GEO pages (generated)

Case articles, hubs and technical SEO files are generated from data:

- `data/cases.json` — single source of truth for cases (task, what was done, result, stats, niches, countries).
  Field `insights` — extra expert notes per case (empty for now; filled with Katerina).
  Field `client_name_public` — whether the client name may be published (`null` = not confirmed).
- `data/taxonomy.json` — niches, countries, services. Hubs are generated only when there are 2+ cases.
- `data/site.json` — site URL used in canonical, Open Graph, sitemap. Change after buying the domain.

Build: `python3 tools/build_pages.py` — writes `keysy/`, `nishi/`, `strany/`, `robots.txt`, `sitemap.xml`,
`assets/case-pages.js` and updates `<!-- GEN:... -->` blocks in `index.html`, `cases-target.html`, `cases-context.html`.
The build is idempotent: running it twice gives the same result.
