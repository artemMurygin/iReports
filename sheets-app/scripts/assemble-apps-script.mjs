// Assembles the ready-to-push Apps Script project into apps-script/dist.
//
// This script is a pure assembly step: it does NOT build the frontend or the
// apps-script TypeScript backend itself — it only expects both to already be
// built, and copies/arranges their outputs into apps-script/dist, which is
// the folder apps-script/.clasp.json's `rootDir` points at. Build ordering
// is controlled by the "build" script in package.json, not by this file.
//
// It never runs `clasp push`/`clasp deploy`/`clasp login` — deployment stays
// a manual, human-only step (see apps-script/README.md and this workspace's
// README.md).

import { existsSync, cpSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sheetsAppRoot = path.resolve(__dirname, '..')

const frontendIndexHtml = path.join(sheetsAppRoot, 'dist', 'index.html')
const appsScriptDir = path.join(sheetsAppRoot, 'apps-script')
const appsScriptDist = path.join(appsScriptDir, 'dist')
const appsScriptManifestSrc = path.join(appsScriptDir, 'appsscript.json')

const appsScriptManifestDest = path.join(appsScriptDist, 'appsscript.json')
const uploadHtmlDest = path.join(appsScriptDist, 'upload.html')

function fail(message) {
    console.error(`\n[assemble-apps-script] ERROR: ${message}\n`)
    process.exit(1)
}

if (!existsSync(frontendIndexHtml)) {
    fail(
        `Frontend bundle not found at ${frontendIndexHtml}.\n` +
            'Build the frontend first (e.g. "vite build" / "npm run build --workspace=sheets-app" before this step runs).',
    )
}

if (!existsSync(appsScriptDist)) {
    fail(
        `Compiled Apps Script backend not found at ${appsScriptDist}.\n` +
            'Build the apps-script package first (e.g. "npm run build" inside sheets-app/apps-script).',
    )
}

console.log('[assemble-apps-script] Assembling Apps Script project into apps-script/dist ...')

cpSync(appsScriptManifestSrc, appsScriptManifestDest)
console.log(
    `  copied ${path.relative(sheetsAppRoot, appsScriptManifestSrc)} -> ${path.relative(sheetsAppRoot, appsScriptManifestDest)}`,
)

cpSync(frontendIndexHtml, uploadHtmlDest)
console.log(
    `  copied ${path.relative(sheetsAppRoot, frontendIndexHtml)} -> ${path.relative(sheetsAppRoot, uploadHtmlDest)}`,
)

const finalListing = readdirSync(appsScriptDist).sort()
console.log(`\n[assemble-apps-script] Final contents of ${path.relative(sheetsAppRoot, appsScriptDist)}/:`)
for (const entry of finalListing) {
    console.log(`  - ${entry}`)
}

console.log(
    '\n[assemble-apps-script] Done. Review apps-script/dist, then push manually with "npm run sheets-app:push" once .clasp.json has a real scriptId.\n',
)
