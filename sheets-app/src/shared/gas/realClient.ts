import { GAS_HTTP_ERROR_MARKER, GasHttpError } from './types'
import type { GasApi } from './types'
import './googleScriptRun.d'

/**
 * Apps Script webhooks throw `GAS_HTTP_ERROR:{"code":429,"message":"..."}` on an HTTP failure (FR12); anything else
 * is passed through unchanged.
 */
export function decodeGasError(error: unknown): unknown {
    const text = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
    const at = text.indexOf(GAS_HTTP_ERROR_MARKER)
    if (at < 0) return error
    try {
        // `JSON.stringify` never emits a raw newline, so the payload ends at the first one; Apps Script appends
        // a stack («at fetchWebhook_(Code:71:15)») after it.
        const payload = text.slice(at + GAS_HTTP_ERROR_MARKER.length).split('\n')[0]
        const { code, message } = JSON.parse(payload) as {
            code: number
            message?: string
        }
        if (typeof code === 'number') return new GasHttpError(code, message ?? '')
    } catch {
        // malformed marker: fall through
    }
    return error
}

/**
 * Wraps a call to a server-side Apps Script function (`google.script.run.<fnName>(...args)`)
 * in a Promise, using the `withSuccessHandler`/`withFailureHandler` fluent builder.
 */
export function callGas<T>(fnName: string, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const run = window.google?.script?.run
        if (!run) {
            reject(new Error('google.script.run is not available in this environment'))
            return
        }

        const handlers = run
            .withSuccessHandler((value: unknown) => resolve(value as T))
            .withFailureHandler((error: unknown) => reject(decodeGasError(error)))

        const fn = handlers[fnName]
        if (typeof fn !== 'function') {
            reject(new Error(`google.script.run.${fnName} is not a function`))
            return
        }

        fn(...args)
    })
}

/** GasApi implementation that delegates every method to the real `google.script.run` bridge. */
export const realGasClient: GasApi = {
    processFile: (base64Data) => callGas('processFile', base64Data),
    cancelImport: (uuid) => callGas('cancelImport', uuid),
    loadPricesFromMS: () => callGas('loadPricesFromMS'),
    uploadPricesToMS: () => callGas('uploadPricesToMS'),
    uploadSalePricesToMS: () => callGas('uploadSalePricesToMS'),
    uploadPricesToRO: () => callGas('uploadPricesToRO'),
    getAccrualsSheetEntries: () => callGas('getAccrualsSheetEntries'),
    fetchServiceBonusesMap: () => callGas('fetchServiceBonusesMap'),
    applyAccrualsUpdates: (entries, earningsById) => callGas('applyAccrualsUpdates', entries, earningsById),
    getServiceCategories: () => callGas('getServiceCategories'),
    writeCategoryPathToActiveCell: (path) => callGas('writeCategoryPathToActiveCell', path),
    getCreateServiceRows: () => callGas('getCreateServiceRows'),
    createServiceInRoapp: (payload) => callGas('createServiceInRoapp', payload),
    writeCreateServiceResult: (row, value) => callGas('writeCreateServiceResult', row, value),
    getLastRun: (operation) => callGas('getLastRun', operation),
    saveLastRun: (report) => callGas('saveLastRun', report),
    getAllLastRuns: () => callGas('getAllLastRuns'),
}
