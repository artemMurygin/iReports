import { useState } from 'react'
import { gas } from '@/shared/gas'
import { openImportProgressStream } from '@/shared/gas/progressStream'
import { useOperationStore } from '@/features/operations/operationContext'
import type { ProgressApi } from '@/features/operations/operationContext'
import { OperationSkipped, useOperation } from '@/features/operations/useOperation'
import { parseMoySkladError } from './moySkladErrors'
import { MOY_SKLAD_FUNCTIONS, MS_IMPORT_ID, MS_IMPORT_PROGRESS_TITLE } from './moySkladFunctions'

export interface UseMoySkladActionsParams {
    /** Selected price file; owned by `App` so it survives tab switches. */
    file: File | null
}

export interface MoySkladWarning {
    title: string
    detail?: string
}

function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string) ?? '').split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
        reader.readAsDataURL(file)
    })
}

/**
 * Resolves when the SSE import stream completes, rejects on a FAILED event or a broken connection. Cancel closes
 * the stream and skips the operation (FR13). The stage text comes from the stream.
 */
function waitForImport(uuid: string, progress: ProgressApi): Promise<void> {
    return new Promise((resolve, reject) => {
        const close = openImportProgressStream(uuid, {
            onMessage: (message) => progress.setMessage(message),
            onCompleted: () => resolve(),
            onFailed: (message) => reject(new Error(message)),
            onConnectionError: () => reject(new Error('Соединение прервано')),
        })
        progress.setCancelHandler(() => {
            close?.()
            reject(new OperationSkipped())
        })
    })
}

function progressTitle(id: string): string {
    return MOY_SKLAD_FUNCTIONS.find((fn) => fn.id === id)?.progressTitle ?? ''
}

/**
 * Implements FR2, FR4, FR6, FR12 of sheets-app-redesign: handlers of the "Мой склад" tab on top of the shared
 * `useOperation` template. Reproduces the reference sidebar's uploadFile/startProgressStream/loadPrices/
 * uploadPrices/uploadSalePrices (frontend/GoogleSheetsInterface/index.html, lines ~639-772). Progress goes through the
 * shared `ProgressModal` (FR9): blocking webhooks get an indeterminate bar, the SSE import a status text and cancel.
 */
export function useMoySkladActions({ file }: UseMoySkladActionsParams) {
    const [warning, setWarning] = useState<MoySkladWarning | null>(null)

    const importOp = useOperation(MS_IMPORT_ID)
    const uploadRc = useOperation('ms.uploadRc', parseMoySkladError)
    const uploadSale = useOperation('ms.uploadSale', parseMoySkladError)
    const load = useOperation('ms.load', parseMoySkladError)

    const { progress } = useOperationStore()

    /** Opens the progress modal for the task and always closes it (blocking calls: no status text, no cancel). */
    async function withProgress(title: string, task: () => Promise<unknown>, cancellable = false) {
        progress.begin(title, { cancellable })
        try {
            return await task()
        } finally {
            progress.end()
        }
    }

    async function handleUploadFile() {
        if (!file) {
            setWarning({ title: 'Выберите файл', detail: 'Сначала загрузите прайс в формате .xlsx' })
            return
        }
        setWarning(null)
        await importOp.run(() =>
            withProgress(
                MS_IMPORT_PROGRESS_TITLE,
                async () => {
                    const uuid = await gas.processFile(await readAsBase64(file))
                    if (progress.isCancelled()) throw new OperationSkipped()
                    await waitForImport(uuid, progress)
                },
                true,
            ),
        )
    }

    const handleLoadPrices = () => load.run(() => withProgress(progressTitle('ms.load'), () => gas.loadPricesFromMS()))
    const handleUploadPrices = () =>
        uploadRc.run(() => withProgress(progressTitle('ms.uploadRc'), () => gas.uploadPricesToMS()))
    const handleUploadSalePrices = () =>
        uploadSale.run(() => withProgress(progressTitle('ms.uploadSale'), () => gas.uploadSalePricesToMS()))

    return {
        warning,
        setWarning,
        importOp,
        operations: { 'ms.uploadRc': uploadRc, 'ms.uploadSale': uploadSale, 'ms.load': load },
        handlers: {
            'ms.uploadRc': handleUploadPrices,
            'ms.uploadSale': handleUploadSalePrices,
            'ms.load': handleLoadPrices,
        },
        handleUploadFile,
    }
}
