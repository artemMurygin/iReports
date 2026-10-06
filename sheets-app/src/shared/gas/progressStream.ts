import { isGasEnvironment } from './index'
import { BASE_URL } from './config'

/**
 * Callbacks driving a price-import progress stream (see `openImportProgressStream`).
 * `onMessage` may fire any number of times before exactly one of `onCompleted` /
 * `onFailed` / `onCancelled` / `onConnectionError` fires, terminating the stream.
 * `onCancelled` fires when the job was cancelled (e.g. from another sidebar window).
 */
export interface ProgressStreamHandlers {
    onMessage: (message: string) => void
    onCompleted: () => void
    onFailed: (errorMessage: string) => void
    onConnectionError: () => void
    onCancelled?: () => void
}

/** Shape of a single SSE `message` event's JSON payload, see the reference's `startProgressStream`. */
interface ImportProgressEvent {
    /** Present (truthy) only on heartbeat events, which carry no status/progress and are skipped. */
    type?: string
    status?: 'COMPLETED' | 'FAILED' | 'CANCELLED' | string
    progress?: {
        message?: string | null
    } | null
    errorMessage?: string | null
}

/** Interval between status polls that back up the SSE stream. */
const STATUS_POLL_INTERVAL_MS = 1500

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
    let lastMessage: string | null = null
    const finish = () => {
        finished = true
        clearInterval(poll)
        es.close()
    }

    // The same snapshot handler serves both the SSE `message` events and the status polling below.
    const handle = (data: ImportProgressEvent) => {
        if (finished) return

        // Heartbeat events (every 20s, see SubscribePriceImportJobProgressHttpController) carry
        // no status/progress fields — skip them.
        if (data.type) return

        const { status, progress, errorMessage } = data
        const message = progress?.message ?? null
        if (message && message !== lastMessage) {
            lastMessage = message
            handlers.onMessage(message)
        }
        if (status === 'COMPLETED') {
            finish()
            handlers.onCompleted()
        } else if (status === 'FAILED') {
            finish()
            handlers.onFailed(errorMessage || message || 'Ошибка импорта')
        } else if (status === 'CANCELLED') {
            finish()
            handlers.onCancelled?.()
        }
    }

    es.onmessage = (event) => handle(JSON.parse(event.data) as ImportProgressEvent)

    // Fallback: a reverse proxy may buffer SSE until the stream closes, so the status is also polled.
    // Failed polls are ignored, the SSE stream stays the source of terminal errors.
    const poll = setInterval(() => {
        fetch(`${BASE_URL}/v1/shop/marketing/pricing/import-costs/${uuid}/status`)
            .then((response) => (response.ok ? (response.json() as Promise<ImportProgressEvent>) : null))
            .then((data) => {
                if (data) handle(data)
            })
            .catch(() => {})
    }, STATUS_POLL_INTERVAL_MS)

    es.onerror = () => {
        if (finished) return
        finish()
        handlers.onConnectionError()
    }

    return finish
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

/** Real lookup: id of the import running on the backend (null when none, or when the request fails). */
async function realFetchActiveImportId(): Promise<string | null> {
    try {
        const response = await fetch(`${BASE_URL}/v1/shop/marketing/pricing/active-import-costs`)
        if (!response.ok) return null
        const { id } = (await response.json()) as { id: string | null }
        return id ?? null
    } catch {
        return null
    }
}

/**
 * Id of the price import still running on the backend, so a reopened sidebar can reattach to its progress.
 * The mock has no backend job to resume.
 */
export const fetchActiveImportId: () => Promise<string | null> = isGasEnvironment
    ? realFetchActiveImportId
    : () => Promise.resolve(null)

/** Result of the last scheduled (cron) price import remembered by the backend. */
export interface LastScheduledImport {
    status: 'success' | 'error'
    /** Epoch ms. */
    finishedAt: number
}

/** Real lookup: null when the backend has no cron run on record, or when the request fails. */
async function realFetchLastScheduledImport(): Promise<LastScheduledImport | null> {
    try {
        const response = await fetch(`${BASE_URL}/v1/shop/marketing/pricing/last-scheduled-import`)
        if (!response.ok) return null
        const { run } = (await response.json()) as { run: LastScheduledImport | null }
        return run ?? null
    } catch {
        return null
    }
}

/**
 * Result of the last price import run by the backend cron. It never touches the spreadsheet, so the sidebar asks
 * for it on open and shows the newer of this and its own stored run. The mock has no backend cron.
 */
export const fetchLastScheduledImport: () => Promise<LastScheduledImport | null> = isGasEnvironment
    ? realFetchLastScheduledImport
    : () => Promise.resolve(null)
