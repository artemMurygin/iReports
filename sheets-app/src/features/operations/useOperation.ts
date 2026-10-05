import { useCallback } from 'react'
import { IDLE_OPERATION, useOperationStore } from './operationContext'
import type { OperationError, OperationState } from './operationContext'
import { saveOperationRun } from './operationStore'

export type ErrorParser = (err: unknown) => OperationError

/** Thrown by a task that found nothing to do: the operation returns to idle instead of success or error. */
export class OperationSkipped extends Error {}

/** Thrown by a task that finished with a failure but still has a result to show (e.g. RO upload with errors). */
export class OperationFailure extends Error {
    result: unknown
    constructor(message: string, result?: unknown) {
        super(message)
        this.result = result
    }
}

const defaultParser: ErrorParser = (err) => {
    const message = err instanceof Error ? err.message : String(err)
    return { title: 'Не удалось выполнить операцию', detail: message }
}

/**
 * Implements FR4, FR6 of sheets-app-redesign: the shared show/busy/try/finally template of a function run.
 * `run(task)` marks the operation running, then success (with the finish time) or error (parsed by
 * `parseError`), and saves it as the function's last run (FR11). State is independent per `id` and survives tab switches (see `OperationProvider`).
 */
export function useOperation(id: string, parseError: ErrorParser = defaultParser) {
    const { states, patch } = useOperationStore()
    const state: OperationState = states[id] ?? IDLE_OPERATION

    const run = useCallback(
        async (task: () => Promise<unknown>): Promise<boolean> => {
            patch(id, { status: 'running', bannerOpen: false, result: undefined })
            try {
                const result = await task()
                const next: OperationState = {
                    status: 'success',
                    finishedAt: Date.now(),
                    error: undefined,
                    bannerOpen: false,
                    result,
                }
                patch(id, next)
                void saveOperationRun(id, next)
                return true
            } catch (err) {
                if (err instanceof OperationSkipped) {
                    patch(id, { status: 'idle', bannerOpen: false })
                    return false
                }
                const next: OperationState = {
                    status: 'error',
                    finishedAt: Date.now(),
                    error: parseError(err),
                    bannerOpen: true,
                    result: err instanceof OperationFailure ? err.result : undefined,
                }
                patch(id, next)
                void saveOperationRun(id, next)
                return false
            }
        },
        [id, patch, parseError],
    )

    const closeBanner = useCallback(() => patch(id, { bannerOpen: false }), [id, patch])

    return { state, running: state.status === 'running', run, closeBanner }
}
