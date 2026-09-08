import { isGasEnvironment } from './index'
import { BASE_URL } from './config'

/**
 * Callbacks driving a price-import progress stream (see `openImportProgressStream`).
 * `onMessage` may fire any number of times before exactly one of `onCompleted` /
 * `onFailed` / `onConnectionError` fires, terminating the stream.
 */
export interface ProgressStreamHandlers {
    onMessage: (message: string) => void
    onCompleted: () => void
    onFailed: (errorMessage: string) => void
    onConnectionError: () => void
}

/** Shape of a single SSE `message` event's JSON payload, see the reference's `startProgressStream`. */
interface ImportProgressEvent {
    /** Present (truthy) only on heartbeat events, which carry no status/progress and are skipped. */
    type?: string
    status?: 'COMPLETED' | 'FAILED' | string
    progress?: { message?: string | null } | null
    errorMessage?: string | null
}

/** A cleanup function that tears down an open progress stream (closes the connection / clears timers). */
export type CloseProgressStream = () => void

/**
 * Opens a real SSE stream against the backend's price-import progress endpoint, mirroring the
 * reference sidebar's `startProgressStream` (frontend/GoogleSheetsInterface/index.html lines
 * ~639-683) exactly: heartbeat events (`{ type: ... }`) are skipped, `progress.message` drives
 * `onMessage`, and `status === 'COMPLETED' | 'FAILED'` closes the stream and fires the matching
 * terminal handler. `es.onerror` closes the stream and fires `onConnectionError`, unless the
 * stream had already reached a terminal state.
 */
export function realOpenImportProgressStream(uuid: string, handlers: ProgressStreamHandlers): CloseProgressStream {
    const es = new EventSource(`${BASE_URL}/v1/shop/marketing/pricing/import-costs/${uuid}`)
    let finished = false

    es.onmessage = (event) => {
        const data = JSON.parse(event.data) as ImportProgressEvent

        // Heartbeat events (every 20s, see SubscribePriceImportJobProgressHttpController) carry
        // no status/progress fields — skip them.
        if (data.type) return

        const { status, progress, errorMessage } = data
        const message = progress?.message ?? null
        if (message) handlers.onMessage(message)

        if (status === 'COMPLETED') {
            finished = true
            es.close()
            handlers.onCompleted()
        } else if (status === 'FAILED') {
            finished = true
            es.close()
            handlers.onFailed(errorMessage || message || 'Ошибка импорта')
        }
    }

    es.onerror = () => {
        es.close()
        if (finished) return
        finished = true
        handlers.onConnectionError()
    }

    return () => {
        finished = true
        es.close()
    }
}

/** Plausible progress messages synthesized by the mock stream, in emission order. */
const MOCK_PROGRESS_MESSAGES = [
    'Парсим файл...',
    'Импортируем Apple(iPhone, Watch)...',
    'Импортируем Apple (iPad, Macbook)...',
]

/** Delay in ms between each synthesized mock event. */
const MOCK_STEP_DELAY_MS = 500

/**
 * Local-dev stand-in for `realOpenImportProgressStream`: makes no network call. Instead it
 * synthesizes a short, realistic `onMessage` sequence via `setTimeout`, then calls
 * `onCompleted()`, over roughly `MOCK_PROGRESS_MESSAGES.length * MOCK_STEP_DELAY_MS` ms. The
 * returned cleanup function clears any pending timeouts so an unmount/explicit close never
 * fires a callback afterwards (keeps dev/test runs free of stray `act()` warnings).
 */
export function mockOpenImportProgressStream(_uuid: string, handlers: ProgressStreamHandlers): CloseProgressStream {
    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    MOCK_PROGRESS_MESSAGES.forEach((message, index) => {
        timeouts.push(
            setTimeout(
                () => {
                    if (!cancelled) handlers.onMessage(message)
                },
                (index + 1) * MOCK_STEP_DELAY_MS,
            ),
        )
    })

    timeouts.push(
        setTimeout(
            () => {
                if (!cancelled) handlers.onCompleted()
            },
            (MOCK_PROGRESS_MESSAGES.length + 1) * MOCK_STEP_DELAY_MS,
        ),
    )

    return () => {
        cancelled = true
        timeouts.forEach(clearTimeout)
    }
}

/** The active progress-stream opener: real SSE in Apps Script, synthesized mock otherwise. */
export const openImportProgressStream: (uuid: string, handlers: ProgressStreamHandlers) => CloseProgressStream =
    isGasEnvironment ? realOpenImportProgressStream : mockOpenImportProgressStream
