/**
 * Persistence of the "last run" of every sidebar function (FR11 of sheets-app-redesign): one
 * `PropertiesService.getDocumentProperties()` entry per operation, so a status survives reopening the
 * sidebar and is shared by everyone who works with the spreadsheet. No new OAuth scopes are needed.
 *
 * Limits of PropertiesService: 9 KB per value, 500 KB per store. Only a compact summary is kept: counters,
 * a clamped message and up to LAST_RUN_MAX_ERRORS row errors (not the full report), so one entry is far below
 * 9 KB and the whole store is a few KB. Operation ids are validated, so the key set cannot grow unbounded.
 *
 * NOTE: free of `import`/`export` (see ../README.md); its Vitest test loads the file through `vm` with a fake
 * `PropertiesService` — see `sheets-app/src/features/__appsScriptPorts__/lastRun.test.ts`.
 */

const LAST_RUN_PREFIX = 'lastRun.'
const LAST_RUN_MAX_VALUE_CHARS = 8000
const LAST_RUN_MAX_ERRORS = 5
const LAST_RUN_MAX_ERROR_CHARS = 200
const LAST_RUN_MAX_MESSAGE_CHARS = 500
const LAST_RUN_OP_RE = /^[A-Za-z0-9_.-]{1,40}$/

interface LastRunReport_ {
    operation: string
    status: 'success' | 'error'
    finishedAt: number
    counters?: { [key: string]: number }
    title?: string
    message?: string
    errorCode?: string
    errors?: string[]
}

function clampText_(value: unknown, max: number): string {
    const text = String(value)
    return text.length > max ? text.slice(0, max - 1) + '…' : text
}

/** Validates and compacts a report; returns null when it is not a storable report. */
function normalizeLastRun_(report: LastRunReport_): LastRunReport_ | null {
    if (!report || typeof report.operation !== 'string' || !LAST_RUN_OP_RE.test(report.operation)) return null
    if (report.status !== 'success' && report.status !== 'error') return null

    const finishedAt = Number(report.finishedAt)
    const out: LastRunReport_ = {
        operation: report.operation,
        status: report.status,
        finishedAt: isFinite(finishedAt) ? finishedAt : Date.now(),
    }

    if (report.counters && typeof report.counters === 'object') {
        const counters: { [key: string]: number } = {}
        Object.keys(report.counters)
            .slice(0, 20)
            .forEach(function (key) {
                const n = Number(report.counters![key])
                if (isFinite(n)) counters[clampText_(key, 40)] = n
            })
        out.counters = counters
    }
    if (report.title !== undefined) out.title = clampText_(report.title, 120)
    if (report.message !== undefined) out.message = clampText_(report.message, LAST_RUN_MAX_MESSAGE_CHARS)
    if (report.errorCode !== undefined) out.errorCode = clampText_(report.errorCode, 20)
    if (Array.isArray(report.errors)) {
        out.errors = report.errors.slice(0, LAST_RUN_MAX_ERRORS).map(function (e) {
            return clampText_(e, LAST_RUN_MAX_ERROR_CHARS)
        })
    }

    // Defensive: drop the heaviest optional parts until the value fits the PropertiesService limit.
    if (JSON.stringify(out).length > LAST_RUN_MAX_VALUE_CHARS) delete out.errors
    if (JSON.stringify(out).length > LAST_RUN_MAX_VALUE_CHARS) delete out.message
    return out
}

function parseLastRun_(raw: string | null | undefined): LastRunReport_ | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        return normalizeLastRun_(parsed)
    } catch (e) {
        return null
    }
}

/** Returns the stored report of `operation`, or null when it never ran (or the value is corrupt). */
function getLastRun(operation: string): LastRunReport_ | null {
    if (!LAST_RUN_OP_RE.test(String(operation))) return null
    return parseLastRun_(PropertiesService.getDocumentProperties().getProperty(LAST_RUN_PREFIX + operation))
}

/** Stores the compacted report. Returns 'OK'; throws on an invalid report. */
function saveLastRun(report: LastRunReport_): string {
    const normalized = normalizeLastRun_(report)
    if (!normalized) throw new Error('Некорректный отчёт о запуске')
    PropertiesService.getDocumentProperties().setProperty(
        LAST_RUN_PREFIX + normalized.operation,
        JSON.stringify(normalized),
    )
    return 'OK'
}

/** Returns every stored report keyed by operation id (one round trip on sidebar open). */
function getAllLastRuns(): { [operation: string]: LastRunReport_ } {
    const all = PropertiesService.getDocumentProperties().getProperties()
    const result: { [operation: string]: LastRunReport_ } = {}
    Object.keys(all).forEach(function (key) {
        if (key.indexOf(LAST_RUN_PREFIX) !== 0) return
        const report = parseLastRun_(all[key])
        if (report) result[report.operation] = report
    })
    return result
}
