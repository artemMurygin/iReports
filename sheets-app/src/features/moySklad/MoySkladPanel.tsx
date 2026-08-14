import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/tw'
import { gas } from '@/shared/gas'
import { openImportProgressStream } from '@/shared/gas/progressStream'
import type { GlassLoaderController } from '@/shared/gsheets-ui/useGlassLoaderController'
import type { StatusColor } from '@/shared/gsheets-ui/StatusLine'

const H4_CLASS = 'my-[1.33em] text-base font-bold'

const UPLOAD_LABEL = 'Загрузить прайс'
const UPLOAD_LABEL_BUSY = 'Загрузка...'
const UPLOAD_RC_LABEL = '⬆ Обновить РЦ в МС'
const UPLOAD_SALE_LABEL = '⬆ Обновить акционную РЦ в МС'
const LOAD_LABEL = '⬇ Получить цены из МС'
const SYNC_LABEL_BUSY = 'Выгрузка...'
const LOAD_LABEL_BUSY = 'Загрузка...'

interface MoySkladPanelProps {
    /** Shared glass-loader controller (see `useGlassLoaderController`), owned by `App`. */
    loader: GlassLoaderController
    /** Reports a status-line message + color up to `App`'s bottom `StatusLine`. */
    onStatus: (message: string, color: StatusColor) => void
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
}

// Reproduces the reference sidebar's "Мой склад" tab (frontend/GoogleSheetsInterface/index.html
// uploadFile/startProgressStream/loadPrices/uploadPrices/uploadSalePrices, lines ~639-772):
// price-file upload + SSE import progress, plus the three one-shot МойСклад sync buttons.
export function MoySkladPanel({ loader, onStatus }: MoySkladPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [isDragActive, setIsDragActive] = useState(false)

    const [uploadBusy, setUploadBusy] = useState(false)
    const [uploadRcBusy, setUploadRcBusy] = useState(false)
    const [uploadSaleBusy, setUploadSaleBusy] = useState(false)
    const [loadBusy, setLoadBusy] = useState(false)

    const dropZoneHighlighted = isDragActive || file !== null

    function handleDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        setIsDragActive(true)
    }

    function handleDragLeave() {
        setIsDragActive(false)
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault()
        setIsDragActive(false)
        const dropped = event.dataTransfer.files[0]
        if (dropped) setFile(dropped)
    }

    function handleUploadFile() {
        if (!file) {
            onStatus('⚠️ Выберите файл', 'warning')
            return
        }

        loader.show('Загрузка файла на сервер...')
        setUploadBusy(true)
        onStatus('', 'neutral')

        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1] ?? ''

            gas.processFile(base64).then(
                (uuid) => {
                    loader.update('Подключение к потоку...')
                    openImportProgressStream(uuid, {
                        onMessage: (message) => {
                            loader.update(message)
                            loader.addLog(message)
                        },
                        onCompleted: () => {
                            loader.hide()
                            onStatus('✅ Готово!', 'success')
                            setUploadBusy(false)
                        },
                        onFailed: (message) => {
                            loader.hide()
                            onStatus('❌ ' + message, 'error')
                            setUploadBusy(false)
                        },
                        onConnectionError: () => {
                            loader.hide()
                            onStatus('❌ Соединение прервано', 'error')
                            setUploadBusy(false)
                        },
                    })
                },
                (err: unknown) => {
                    loader.hide()
                    onStatus('❌ ' + errorMessage(err), 'error')
                    setUploadBusy(false)
                },
            )
        }
        reader.readAsDataURL(file)
    }

    async function handleLoadPrices() {
        loader.show('Получаем цены из МойСклад')
        setLoadBusy(true)
        onStatus('', 'neutral')
        try {
            await gas.loadPricesFromMS()
            loader.hide()
            onStatus('✅ РЦ загружена из МойСклад!', 'success')
        } catch (err) {
            loader.hide()
            onStatus('❌ ' + errorMessage(err), 'error')
        } finally {
            setLoadBusy(false)
        }
    }

    async function handleUploadPrices() {
        loader.show('Выгружаем РЦ в МойСклад')
        setUploadRcBusy(true)
        onStatus('', 'neutral')
        try {
            await gas.uploadPricesToMS()
            loader.hide()
            onStatus('✅ РЦ выгружена в МойСклад!', 'success')
        } catch (err) {
            loader.hide()
            onStatus('❌ ' + errorMessage(err), 'error')
        } finally {
            setUploadRcBusy(false)
        }
    }

    async function handleUploadSalePrices() {
        loader.show('Выгружаем акционную цену в МойСклад')
        setUploadSaleBusy(true)
        onStatus('', 'neutral')
        try {
            await gas.uploadSalePricesToMS()
            loader.hide()
            onStatus('✅ Акционная РЦ выгружена в МойСклад!', 'success')
        } catch (err) {
            loader.hide()
            onStatus('❌ ' + errorMessage(err), 'error')
        } finally {
            setUploadSaleBusy(false)
        }
    }

    return (
        <>
            <h4 className={H4_CLASS}>Загрузите прайс Trade-mi</h4>

            <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'mb-3 cursor-pointer rounded-[10px] border-[1.5px] border-dashed p-[20px_12px] text-center transition-all duration-200',
                    dropZoneHighlighted ? 'border-brand-green bg-[#f0f9f5]' : 'border-[#ccc] bg-[#fafafa]',
                )}
            >
                <Upload strokeWidth={2} className="mx-auto mb-2 h-7 w-7 text-brand-green" />
                <p className="m-0 text-[13px] leading-[1.4] text-[#555]">
                    {file?.name ?? 'Нажмите или перетащите файл'}
                </p>
            </div>

            <p className="mt-1 mb-[14px] text-[13px] leading-[1.5] text-[#888]">
                В таблице обязательно должны быть страницы &laquo;Apple(iPhone, Watch)&raquo; и &laquo;Apple (iPad,
                Macbook)&raquo;. Формат: .xlsx, .xls.
            </p>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                    const selected = event.target.files?.[0]
                    if (selected) setFile(selected)
                }}
            />

            <Button
                onClick={handleUploadFile}
                disabled={uploadBusy}
                className="mb-2 h-auto w-full rounded-lg bg-brand-green p-[11px] text-sm font-semibold text-white hover:bg-brand-green/90"
            >
                {uploadBusy ? UPLOAD_LABEL_BUSY : UPLOAD_LABEL}
            </Button>

            <h4 className={H4_CLASS}>Синхронизация с Мой Склад</h4>

            <div className="mb-1 flex flex-col gap-2">
                <Button
                    variant="outline"
                    onClick={handleUploadPrices}
                    disabled={uploadRcBusy}
                    className="h-auto justify-center rounded-lg border-[1.5px] border-brand-green bg-white p-[10px] text-[13px] font-semibold text-brand-green shadow-none hover:bg-brand-green/5 hover:text-brand-green"
                >
                    {uploadRcBusy ? SYNC_LABEL_BUSY : UPLOAD_RC_LABEL}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleUploadSalePrices}
                    disabled={uploadSaleBusy}
                    className="h-auto justify-center rounded-lg border-[1.5px] border-brand-green bg-white p-[10px] text-[13px] font-semibold text-brand-green shadow-none hover:bg-brand-green/5 hover:text-brand-green"
                >
                    {uploadSaleBusy ? SYNC_LABEL_BUSY : UPLOAD_SALE_LABEL}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleLoadPrices}
                    disabled={loadBusy}
                    className="h-auto justify-center rounded-lg border-[1.5px] border-brand-blue bg-white p-[10px] text-[13px] font-semibold text-brand-blue shadow-none hover:bg-brand-blue/5 hover:text-brand-blue"
                >
                    {loadBusy ? LOAD_LABEL_BUSY : LOAD_LABEL}
                </Button>
            </div>
        </>
    )
}
