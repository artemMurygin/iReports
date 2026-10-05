import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ProgressModal } from '@/shared/gsheets-ui/ProgressModal'
import { IDLE_OPERATION, OperationContext } from './operationContext'
import { loadOperationRuns } from './operationStore'
import type { OperationState, OperationStore, ProgressApi, ProgressState } from './operationContext'

/**
 * Implements FR4, FR2, FR9, FR11, FR13, UX5 of sheets-app-redesign: holds per-function operation state above the
 * panels, because Radix `TabsContent` unmounts the inactive tab and local state would be lost on a tab switch,
 * and owns the single progress modal of the active operation.
 */
export function OperationProvider({ children }: { children: ReactNode }) {
    const [states, setStates] = useState<Record<string, OperationState>>({})
    const [progressState, setProgressState] = useState<ProgressState | null>(null)

    const cancelledRef = useRef(false)
    const cancelHandlerRef = useRef<(() => void) | null>(null)

    const patch = useCallback((id: string, next: Partial<OperationState>) => {
        setStates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? IDLE_OPERATION), ...next } }))
    }, [])

    // FR11: statuses of the previous runs are pulled once on open; a run already started in the meantime wins.
    useEffect(() => {
        let alive = true
        void loadOperationRuns().then((stored) => {
            if (alive) setStates((prev) => ({ ...stored, ...prev }))
        })
        return () => {
            alive = false
        }
    }, [])

    const progress = useMemo<Omit<ProgressApi, 'state'>>(
        () => ({
            begin: (title, options) => {
                cancelledRef.current = false
                cancelHandlerRef.current = null
                setProgressState({
                    title,
                    message: null,
                    cancellable: options?.cancellable ?? false,
                })
            },
            setMessage: (message) => {
                setProgressState((prev) => (prev ? { ...prev, message } : prev))
            },
            setCancelHandler: (handler) => {
                cancelHandlerRef.current = handler
            },
            isCancelled: () => cancelledRef.current,
            cancel: () => {
                cancelledRef.current = true
                cancelHandlerRef.current?.()
            },
            end: () => {
                cancelHandlerRef.current = null
                setProgressState(null)
            },
        }),
        [],
    )

    const value = useMemo<OperationStore>(
        () => ({
            states,
            patch,
            anyRunning: Object.values(states).some((s) => s.status === 'running'),
            progress: { ...progress, state: progressState },
        }),
        [states, patch, progress, progressState],
    )

    return (
        <OperationContext.Provider value={value}>
            {children}
            <ProgressModal
                open={progressState !== null}
                title={progressState?.title ?? ''}
                message={progressState?.message ?? null}
                onCancel={progressState?.cancellable ? progress.cancel : undefined}
            />
        </OperationContext.Provider>
    )
}
