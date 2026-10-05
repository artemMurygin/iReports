import { gas } from '@/shared/gas'
import { openImportProgressStream } from '@/shared/gas/progressStream'
import type { ProgressApi } from '@/features/operations/operationContext'
import { OperationSkipped } from '@/features/operations/useOperation'

/** The part of the progress API the import stream drives (the modal itself is owned by the caller). */
export type ImportProgress = Pick<ProgressApi, 'setMessage' | 'setCancelHandler'>

/**
 * Resolves when the SSE import stream completes, rejects on a FAILED event or a broken connection. Cancel closes
 * the stream, asks the backend to stop the job (aborting its LLM requests) and skips the operation (FR13). A job
 * cancelled elsewhere also ends as skipped. The stage text comes from the stream.
 */
export function waitForImport(uuid: string, progress: ImportProgress): Promise<void> {
    return new Promise((resolve, reject) => {
        const close = openImportProgressStream(uuid, {
            onMessage: (message) => progress.setMessage(message),
            onCompleted: () => resolve(),
            onFailed: (message) => reject(new Error(message)),
            onConnectionError: () => reject(new Error('Соединение прервано')),
            onCancelled: () => reject(new OperationSkipped()),
        })
        progress.setCancelHandler(() => {
            close?.()
            void cancelImportOnServer(uuid)
            reject(new OperationSkipped())
        })
    })
}

/** Best-effort: a 409 (job already writing to МойСклад) or a network error must not break the UI cancel. */
export async function cancelImportOnServer(uuid: string): Promise<void> {
    try {
        await gas.cancelImport(uuid)
    } catch {
        // the job either finished already or is past the point of no return — nothing to undo client-side
    }
}
