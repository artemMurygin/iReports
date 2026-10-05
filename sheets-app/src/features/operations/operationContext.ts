import { createContext, useContext } from 'react'

export type OperationStatus = 'idle' | 'running' | 'success' | 'error'

/** Parsed failure of an operation: what the card footer and the error banner show. */
export interface OperationError {
    /** HTTP code when known (e.g. 429), or `'сети'` for a network failure. */
    code?: string
    title: string
    detail: string
}

export interface OperationState {
    status: OperationStatus
    /** Epoch ms of the last finished run. */
    finishedAt?: number
    error?: OperationError
    /** Value returned by the last successful run (or carried by an `OperationFailure`); feeds the result block. */
    result?: unknown
    /** Restored from a previous session: the footer status is shown, the result block is not. */
    restored?: boolean
    /** The banner can be closed without clearing the card's own error (FR6). */
    bannerOpen: boolean
}

export const IDLE_OPERATION: OperationState = { status: 'idle', bannerOpen: false }

/** What the progress modal shows: a title and the current status text (no percent or ETA, they cannot be computed). */
export interface ProgressState {
    title: string
    /** Current status text of the operation; null until the first status arrives. */
    message: string | null
    /** Cancel is offered only for client loops and the SSE import. */
    cancellable: boolean
}

export interface ProgressBeginOptions {
    cancellable?: boolean
}

/** Implements FR9, FR13 of sheets-app-redesign: the handle an operation uses to drive the progress modal. */
export interface ProgressApi {
    state: ProgressState | null
    /** Opens the modal with an indeterminate bar and no status text and resets the cancel flag. */
    begin: (title: string, options?: ProgressBeginOptions) => void
    /** Current status text (SSE stage, loop step), shown under the title. */
    setMessage: (message: string) => void
    /** Registers what `cancel` must tear down (e.g. close the SSE stream). */
    setCancelHandler: (handler: (() => void) | null) => void
    /** Flag checked between loop iterations. */
    isCancelled: () => boolean
    cancel: () => void
    end: () => void
}

export interface OperationStore {
    states: Record<string, OperationState>
    patch: (id: string, next: Partial<OperationState>) => void
    anyRunning: boolean
    progress: ProgressApi
}

const OperationContext = createContext<OperationStore | null>(null)

export { OperationContext }

export function useOperationStore(): OperationStore {
    const ctx = useContext(OperationContext)
    if (!ctx) throw new Error('useOperationStore must be used inside <OperationProvider>')
    return ctx
}
