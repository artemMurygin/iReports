import { useCallback, useState } from 'react'

/** Shown as the loader subtitle before the first real status text arrives, matching the reference's default. */
const DEFAULT_STATUS_TEXT = 'Подготовка...'

/**
 * State + actions driving a `<GlassLoader>`. Mirrors the reference sidebar's
 * showLoader/updateLoader/addLogLine/hideLoader functions (frontend/GoogleSheetsInterface/
 * index.html lines ~611-637) as a single hook, generic enough to be shared by any tab/flow
 * that needs a busy overlay — this phase wires it into the МС tab, a later phase reuses it
 * for Ремонлайн.
 */
export interface GlassLoaderController {
    active: boolean
    statusText: string
    logLines: string[]
    /** Shows the loader, clearing any previous log lines. `text` seeds the subtitle (defaults like the reference). */
    show: (text?: string) => void
    /** Updates the subtitle text without touching the log. */
    update: (text: string) => void
    /** Appends a line to the scrolling log (the newest line renders emphasized, see `GlassLoader`). */
    addLog: (line: string) => void
    /** Hides the loader. Log lines/subtitle are left as-is until the next `show`. */
    hide: () => void
}

export function useGlassLoaderController(): GlassLoaderController {
    const [active, setActive] = useState(false)
    const [statusText, setStatusText] = useState('')
    const [logLines, setLogLines] = useState<string[]>([])

    const show = useCallback((text?: string) => {
        setLogLines([])
        setStatusText(text || DEFAULT_STATUS_TEXT)
        setActive(true)
    }, [])

    const update = useCallback((text: string) => {
        setStatusText(text)
    }, [])

    const addLog = useCallback((line: string) => {
        setLogLines((lines) => [...lines, line])
    }, [])

    const hide = useCallback(() => {
        setActive(false)
    }, [])

    return { active, statusText, logLines, show, update, addLog, hide }
}
