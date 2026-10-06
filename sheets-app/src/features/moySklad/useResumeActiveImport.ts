import { useEffect, useRef } from 'react'
import { fetchActiveImportId } from '@/shared/gas/progressStream'
import { useOperationStore } from '@/features/operations/operationContext'
import { useOperation } from '@/features/operations/useOperation'
import { waitForImport } from './importFlow'
import { parseMoySkladError } from './moySkladErrors'
import { MS_IMPORT_HINT, MS_IMPORT_ID, MS_IMPORT_PROGRESS_TITLE } from './moySkladFunctions'

/**
 * Reattaches to a price import that is still running on the backend: after the sidebar was closed and reopened it
 * asks for the active job once on mount and shows the same progress modal (with cancel) as a fresh import. Mounted
 * above the tabs, so it works whichever tab is open.
 */
export function useResumeActiveImport() {
    const { progress } = useOperationStore()
    const importOp = useOperation(MS_IMPORT_ID, parseMoySkladError)
    // StrictMode re-runs effects in dev: one lookup per page load, never a second stream for the same job.
    const started = useRef(false)

    useEffect(() => {
        if (started.current) return
        started.current = true

        void fetchActiveImportId().then((uuid) => {
            if (!uuid) return
            void importOp.run(async () => {
                progress.begin(MS_IMPORT_PROGRESS_TITLE, { cancellable: true, hint: MS_IMPORT_HINT })
                try {
                    await waitForImport(uuid, progress)
                } finally {
                    progress.end()
                }
            })
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally once on mount
    }, [])
}
