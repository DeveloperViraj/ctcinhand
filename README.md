# InHand — CTC to in-hand salary calculator (India, FY 2026-27)

A free, fully static salary calculator. Enter a CTC, get monthly in-hand pay with both tax regimes
compared side by side, including provident fund, ESI, gratuity, state professional tax and the
Labour Code wage rule.

Everything runs in the browser. No backend, no database, no API keys, no analytics.

## Commands

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `npm run dev`        | Dev server on http://localhost:4321                                |
| `npm run build`      | Static build into `dist/`                                          |
| `npm run preview`    | Serve the built site locally                                       |
| `npm test`           | Run the calculation test suite (Vitest)                            |
| `npm run check`      | Astro + TypeScript type check                                      |
| `npm run lint`       | ESLint                                                             |
| `npm run format`     | Prettier, write mode                                               |
| `npm run verify`     | Lint, format check, types, tests and build — run before deploying  |
| `npm run lighthouse` | Build, serve and audit key pages; reports in `lighthouse-reports/` |

On Windows, if npm fails with `spawn cmd ENOENT`, the sandbox has stripped `ComSpec`; run
`$env:ComSpec="C:\Windows\System32\cmd.exe"` first.

## Deploying to Cloudflare Pages

The site is static, so no adapter is needed. `wrangler.jsonc` sets `pages_build_output_dir`.

```bash
npm run deploy
```

That runs `verify` and then `wrangler pages deploy ./dist --project-name=inhand`. The first run
prompts you to log in and create the project. For Git-connected builds instead, set the build
command to `npm run build` and the output directory to `dist`.

Note: Astro's Cloudflare **adapter** dropped Pages support in v13, and Cloudflare now steers new
projects to Workers. That only affects server-rendered sites. A static site like this one deploys to
Pages with no adapter at all. To move to Workers later, serve `dist/` as static assets.

`public/_headers` sets security headers and a one-year immutable cache for hashed assets.

## Before you launch

- [ ] Point `SITE` in `src/config/site.ts` and `SITE_URL` in `astro.config.mjs` at the real domain.
- [ ] Set up the contact mailbox (Cloudflare Email Routing forwards a custom domain address to any
      inbox, free).
- [ ] After AdSense approval, replace the placeholder line in `public/ads.txt`, and update the
      advertising section of `/privacy` before ads go live.
- [ ] Re-verify the items listed under “What we could not verify” on `/how-it-works`.

## How the code is organised

```
src/
  lib/tax/        Calculation engine: pure functions, no DOM, fully unit-tested
    rates.ts          Statutory figures with the provision each one comes from
    income-tax.ts     Slabs, rebate, surcharge, marginal relief, cess
    labour-code-wages.ts  The 50% wage rule (Code on Wages s.2(y))
    structure.ts      Resolves a CTC into components, iteratively
    calculate.ts      Ties it together and returns both regimes
  lib/            Formatting, URL state, storage, result rendering, export data
  scripts/        Browser island and the lazily-loaded PDF/Excel exports
  components/     Astro components
  pages/          Routes
```

The calculation engine is deliberately separate from the UI: it has no DOM dependencies, so the same
code runs in tests, at build time (for server-rendered results) and in the browser.

## Accuracy

Statutory rates were verified against primary sources on 2026-09-13 (tax, PF, ESI, Labour Codes) and
2026-09-25 (professional tax by state). `/how-it-works` documents every rate, the assumptions, the
two genuinely ambiguous readings of the Labour Code wage definition, and what could not be verified.

Re-check everything after Union Budget 2027 before using it for the next tax year.

## Licence

Not yet chosen. Add one before making the repository public.
