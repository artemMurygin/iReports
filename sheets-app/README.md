# sheets-app

React rewrite of the Google Sheets sidebar that iRepair staff use to run price uploads/syncs
against МойСклад and RemOnline directly from a Google Таблица. It replaces the legacy inline
`frontend/GoogleSheetsInterface/index.html` + `index.gs` implementation with a proper React
project plus a typed TypeScript port of the Apps Script backend. See
[`docs/sheets-app-react-rewrite/`](../docs/sheets-app-react-rewrite/) for the full PRD
([`prd-sheets-app-react-rewrite.md`](../docs/sheets-app-react-rewrite/prd-sheets-app-react-rewrite.md))
and implementation plan
([`plan-sheets-app-react-rewrite.md`](../docs/sheets-app-react-rewrite/plan-sheets-app-react-rewrite.md)).

This workspace has two independently-building pieces:

- **`src/`** — the React + Vite SPA (the sidebar UI itself), built by Vite into a single
  self-contained `dist/index.html` (no separate JS/CSS assets — required by Apps Script's
  `HtmlService`).
- **`apps-script/`** — a typed TypeScript port of the Apps Script backend (`Code.ts`,
  `pricing.ts`, `categories.ts`, `toNumber_.ts`), its own nested npm package (not an npm
  workspace member) that compiles with `tsc` into plain global-scope JS under
  `apps-script/dist/`, matching how Apps Script concatenates and runs `.gs`/`.js` files. See
  [`apps-script/README.md`](./apps-script/README.md) for why it's TypeScript and how it's
  structured.

## Dev workflow

From the repo root:

```bash
npm run sheets-app:dev
```

This runs the Vite dev server (`vite`) for the React SPA only. Outside of a real Apps Script
context there is no `google.script.run` — the app runs against **mocked** GAS calls so the UI can
be developed and tested without a live Google Sheet. See `src/shared/gas` for the mock layer and
the `GasApi` contract it implements.

## Build workflow

From the repo root:

```bash
npm run sheets-app:build
```

This is the existing root script (`npm run build --workspace=sheets-app`) — it now transparently
runs the **full pipeline**, in order:

1. `tsc --noEmit` — typecheck the React SPA.
2. `vite build` — build the SPA into a single-file bundle at `dist/index.html`.
3. `npm run build --prefix apps-script` — compile the Apps Script TypeScript backend
   (`apps-script/src/*.ts`) with `tsc` into plain JS at `apps-script/dist/*.js`.
4. `node ./scripts/assemble-apps-script.mjs` — assemble a ready-to-push Apps Script project by
   copying `apps-script/appsscript.json` into `apps-script/dist/appsscript.json` and the built SPA
   bundle into `apps-script/dist/upload.html` (that exact filename matters — `Code.ts`'s
   `showUploadForm` calls `HtmlService.createHtmlOutputFromFile('upload')`).

After this runs, `apps-script/dist/` is a complete, ready-to-review Apps Script project —
exactly what `apps-script/.clasp.json`'s `rootDir` points at — containing the compiled backend
`.js` files, `appsscript.json`, and `upload.html`. Nothing in this pipeline pushes anywhere; it
only assembles local files for a human to review and push manually (see below).

The assembly script (`scripts/assemble-apps-script.mjs`) is a pure assembly step: it does not
trigger either build itself, it only verifies `dist/index.html` and `apps-script/dist/` already
exist (failing with a clear message telling you which piece to build first if not) and then
copies files into place. Build ordering is controlled entirely by the `build` script chain above.

## DEPLOYMENT (manual, human-only — read before running `npm run sheets-app:push`)

**Deployment is a manual, human-only action. It is never automated or CI-triggered.** This is an
explicit safety constraint from the project's PRD
([`docs/sheets-app-react-rewrite/prd-sheets-app-react-rewrite.md`](../docs/sheets-app-react-rewrite/prd-sheets-app-react-rewrite.md),
see the warning at the top of the document and the "Не в скоупе" / "Технические ограничения"
sections): the Apps Script project this deploys to is bound to iRepair's real production Google
Sheet, which holds sensitive business data (masters' payroll accruals, prices, RemOnline/МойСклад
links). An accidental or automated push could corrupt that data, so no CI job or script in this
repo runs `clasp push`, `clasp deploy`, or `clasp login` — a `push` script exists
(`npm run sheets-app:push` → `sheets-app/package.json`'s `push` script → `cd apps-script && npx
clasp push`) purely as a documented entry point for a human to run **by hand**, never invoked
automatically.

Before ever running `npm run sheets-app:push`:

1. **Replace the placeholder `scriptId`.** `sheets-app/apps-script/.clasp.json` ships with a
   literal placeholder (`"scriptId": "REPLACE_WITH_EXISTING_SCRIPT_ID"`) — it is not a real ID and
   must never be invented or guessed. Get the real one from the actual Google Sheet
   (**Extensions → Apps Script → Project Settings → Script ID**), or by running
   `clasp clone <realScriptId>` in a separate, throwaway directory to inspect what's deployed
   today, then update `.clasp.json` with the real value.
2. **Reconcile `appsscript.json` against the real project.** The `appsscript.json` in this repo
   (`sheets-app/apps-script/appsscript.json`) is a best-effort approximation (V8 runtime,
   `Europe/Moscow` timezone, Stackdriver exception logging) written without access to the real
   project's manifest. Pull the real one (via `clasp clone`, step 1) and diff/merge it against
   this one before pushing — the real manifest may declare OAuth scopes, library dependencies, or
   webapp settings this starting point doesn't know about.
3. **Manually verify after every push.** Per the PRD's testing-safety note, this repo's automated
   tests only cover pure logic in isolation (e.g. `toNumber_`, see
   `apps-script/README.md`'s "Testing" section) — they do not and cannot exercise the real Apps
   Script/Sheets integration. After any push, a human must open the real Google Sheet, run
   «Таблица → МС / РЕМ → Запустить», and confirm the sidebar and all of its actions (price upload,
   МойСклад sync buttons, RemOnline price upload, accruals refresh, bulk service creation,
   category picker) work correctly before relying on it.

See also [`apps-script/README.md`](./apps-script/README.md) for the same warnings from the Apps
Script sub-package's own perspective.
