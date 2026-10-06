import { gas } from '@/shared/gas'
import { fetchLastScheduledImport } from '@/shared/gas/progressStream'
import type { OperationReport } from '@/shared/gas'
import { IDLE_OPERATION } from './operationContext'
import type { OperationState } from './operationContext'

/** Keeps the numeric fields of a result object: the only part of a result that is worth persisting. */
function toCounters(result: unknown): Record<string, number> | undefined {
    if (!result || typeof result !== 'object') return undefined
    const counters: Record<string, number> = {}
    for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'number' && Number.isFinite(value)) counters[key] = value
    }
    return Object.keys(counters).length > 0 ? counters : undefined
}

/** Implements FR11 of sheets-app-redesign: the persistable summary of a finished run, or null while idle/running. */
export function reportFromState(id: string, state: OperationState): OperationReport | null {
    if (state.status !== 'success' && state.status !== 'error') return null
    const report: OperationReport = {
        operation: id,
        status: state.status,
        finishedAt: state.finishedAt ?? Date.now(),
    }
    const counters = toCounters(state.result)
    if (counters) report.counters = counters
    if (state.status === 'error' && state.error) {
        report.title = state.error.title
        report.message = state.error.detail
        if (state.error.code) report.errorCode = state.error.code
    }
    return report
}

/** Implements FR11 of sheets-app-redesign: restores the card state from a stored report (banner stays closed). */
export function stateFromReport(report: OperationReport): OperationState {
    return {
        ...IDLE_OPERATION,
        status: report.status,
        finishedAt: report.finishedAt,
        result: report.counters,
        restored: true,
        error:
            report.status === 'error'
                ? {
                      code: report.errorCode,
                      title: report.title ?? 'Не удалось выполнить операцию',
                      detail: report.message ?? '',
                  }
                : undefined,
    }
}

/** Saves the finished run; persistence is best-effort, so a storage failure never turns a run into an error. */
export async function saveOperationRun(id: string, state: OperationState): Promise<void> {
    const report = reportFromState(id, state)
    if (!report) return
    try {
        await gas.saveLastRun(report)
    } catch {
        // best-effort
    }
}

/** Operation id of the price-file import; the cron run is shown as its last run (see `moySkladFunctions`). */
const PRICE_IMPORT_ID = 'ms.import'

/** Reads every stored report on sidebar open; resolves to an empty map when the storage is unavailable. */
async function loadStoredRuns(): Promise<Record<string, OperationState>> {
    try {
        const reports = await gas.getAllLastRuns()
        const states: Record<string, OperationState> = {}
        for (const [id, report] of Object.entries(reports ?? {})) states[id] = stateFromReport(report)
        return states
    } catch {
        return {}
    }
}

/** Both sources are best-effort: the cron run is looked up on the backend, and a failure means "no cron run". */
async function loadScheduledImport() {
    try {
        return await fetchLastScheduledImport()
    } catch {
        return null
    }
}

/**
 * Reads every stored report on sidebar open. The price import also runs from the backend cron, which cannot write
 * the spreadsheet's properties, so its result is taken from the backend and wins when it is newer than the stored run.
 */
export async function loadOperationRuns(): Promise<Record<string, OperationState>> {
    const [states, scheduled] = await Promise.all([loadStoredRuns(), loadScheduledImport()])
    const stored = states[PRICE_IMPORT_ID]
    if (scheduled && (stored?.finishedAt === undefined || scheduled.finishedAt > stored.finishedAt)) {
        states[PRICE_IMPORT_ID] = stateFromReport({ operation: PRICE_IMPORT_ID, ...scheduled })
    }
    return states
}
