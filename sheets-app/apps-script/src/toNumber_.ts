/**
 * Parses a spreadsheet cell value (already a JS `number`, or a locale-formatted numeric string)
 * into a finite number, or `null` if it can't be parsed. Ported verbatim from
 * `frontend/GoogleSheetsInterface/index.gs` (`toNumber_`, lines ~129-136) — same name, same
 * behavior, byte-for-byte same logic. Deliberately has ZERO Apps Script API dependency (no
 * `SpreadsheetApp`/`UrlFetchApp`/etc. reference), which is what makes it unit-testable from plain
 * Node — see `sheets-app/src/features/__appsScriptPorts__/toNumber_.test.ts`.
 *
 * Handles values as Google Sheets can hand them over: raw numbers, numbers formatted with spaces
 * (regular or non-breaking, e.g. thousands separators) and/or a comma decimal separator
 * (`"1 234,5"` -> `1234.5`), for use by `uploadPricesToRO` in pricing.ts.
 *
 * NOTE: this file must stay free of `import`/`export` syntax — see the "Why TypeScript for Apps
 * Script" section of ../README.md. That's also why its Vitest test doesn't `import` it directly.
 */
function toNumber_(value: unknown): number | null {
    if (typeof value === 'number') return isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const normalized = value.replace(/[\s ]+/g, '').replace(',', '.')
    if (normalized === '') return null
    const num = Number(normalized)
    return isFinite(num) ? num : null
}
