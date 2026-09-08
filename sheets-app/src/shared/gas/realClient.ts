import type { GasApi } from './types'
import './googleScriptRun.d'

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
            .withFailureHandler((error: unknown) => reject(error))

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
}
