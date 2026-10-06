import { ListChecks } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dropzone } from '@/shared/gsheets-ui/Dropzone'
import { FileCard } from '@/shared/gsheets-ui/FileCard'
import { FuncCard } from '@/shared/gsheets-ui/FuncCard'
import type { FuncCardStatus } from '@/shared/gsheets-ui/FuncCard'
import { GroupLabel } from '@/shared/gsheets-ui/GroupLabel'
import { SectionHeader } from '@/shared/gsheets-ui/SectionHeader'
import { StatusBanner } from '@/shared/gsheets-ui/StatusBanner'
import { formatDateTime } from '@/shared/lib/formatDateTime'
import { useOperationStore } from '@/features/operations/operationContext'
import type { OperationState } from '@/features/operations/operationContext'
import { useMoySkladActions } from './useMoySkladActions'
import { MOY_SKLAD_FUNCTIONS, MS_DROPZONE_HINT, MS_DROPZONE_TITLE, MS_REQUIREMENTS_TEXT } from './moySkladFunctions'
import type { MoySkladFunction } from './moySkladFunctions'

const ACCEPT = ['.xlsx', '.xls']

interface MoySkladPanelProps {
    /** Selected price file, lifted to `App` so it survives tab switches. */
    file: File | null
    onFileChange: (file: File | null) => void
}

/** МойСклад functions report only the run time, never a row count (Q10). */
function cardStatus(state: OperationState): FuncCardStatus {
    const time = state.finishedAt ? formatDateTime(state.finishedAt) : ''
    if (state.status === 'success') return { state: 'success', time }
    if (state.status === 'error') return { state: 'error', time, errorCode: state.error?.code }
    return { state: 'idle' }
}

/**
 * Implements FR2, FR3, FR4, FR6, UX2 of sheets-app-redesign: the "Мой склад" tab. Source block (Dropzone +
 * «Требования», or FileCard + «Загрузить прайс»), then three FuncCards grouped by direction and an error banner.
 * Reproduces the reference sidebar's behaviour (frontend/GoogleSheetsInterface/index.html, lines ~639-772).
 */
export function MoySkladPanel({ file, onFileChange }: MoySkladPanelProps) {
    const { anyRunning } = useOperationStore()
    const { warning, setWarning, importOp, operations, handlers, handleUploadFile } = useMoySkladActions({ file })

    const failed = [importOp, ...Object.values(operations)]
        .filter((op) => op.state.status === 'error' && op.state.bannerOpen && op.state.error)
        .sort((a, b) => (b.state.finishedAt ?? 0) - (a.state.finishedAt ?? 0))[0]

    function renderGroup(group: MoySkladFunction['group'], label: string, direction: 'up' | 'down') {
        return (
            <>
                <GroupLabel direction={direction}>{label}</GroupLabel>
                {MOY_SKLAD_FUNCTIONS.filter((fn) => fn.group === group).map((fn) => {
                    const { state } = operations[fn.id]
                    const run = () => void handlers[fn.id]()
                    return (
                        <FuncCard
                            key={fn.id}
                            data-testid={fn.id}
                            title={fn.title}
                            description={fn.description}
                            tile={fn.tile}
                            tooltip={fn.tooltip}
                            status={cardStatus(state)}
                            disabled={anyRunning}
                            onRun={run}
                            onRetry={run}
                        />
                    )
                })}
            </>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <SectionHeader>Источник данных</SectionHeader>

            {file ? (
                <>
                    <FileCard
                        data-testid="ms-file-card"
                        name={file.name}
                        disabled={importOp.running}
                        onRemove={() => {
                            onFileChange(null)
                            setWarning(null)
                        }}
                    />
                    <Button
                        data-testid="ms-upload-file"
                        variant="ink"
                        block
                        disabled={anyRunning}
                        onClick={() => void handleUploadFile()}
                    >
                        {importOp.running ? 'Загрузка...' : 'Загрузить прайс'}
                    </Button>
                </>
            ) : (
                <>
                    <h3 className="text-sm font-bold text-foreground">Прайс Trade-mi</h3>
                    <Dropzone
                        data-testid="ms-dropzone"
                        data-input-testid="ms-file-input"
                        title={MS_DROPZONE_TITLE}
                        hint={MS_DROPZONE_HINT}
                        accept={ACCEPT}
                        invalid={warning !== null}
                        disabled={anyRunning}
                        onFile={(picked) => {
                            setWarning(null)
                            onFileChange(picked)
                        }}
                        onReject={() =>
                            setWarning({
                                title: 'Неподдерживаемый формат файла',
                                detail: 'Выберите файл .xlsx или .xls',
                            })
                        }
                    />
                    <section
                        aria-label="Требования"
                        data-testid="ms-requirements"
                        className="flex items-start gap-3 rounded-xl border bg-muted px-3.5 py-3"
                    >
                        <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <p className="text-[11.5px] leading-snug text-muted-foreground">{MS_REQUIREMENTS_TEXT}</p>
                    </section>
                </>
            )}

            {importOp.state.finishedAt && importOp.state.status === 'success' ? (
                <p data-testid="ms-import-status" role="status" className="font-mono text-xs text-ok-ink">
                    Прайс загружен · {formatDateTime(importOp.state.finishedAt)}
                </p>
            ) : (
                importOp.state.status !== 'running' && (
                    <p data-testid="ms-import-status" role="status" className="font-mono text-xs text-ink-faint">
                        {importOp.state.finishedAt && importOp.state.status === 'error'
                            ? `Загрузка прайса не удалась · ${formatDateTime(importOp.state.finishedAt)}`
                            : 'Прайс ещё не загружался'}
                    </p>
                )
            )}

            {warning && (
                <StatusBanner
                    data-testid="ms-warning"
                    variant="warning"
                    title={warning.title}
                    detail={warning.detail}
                    onClose={() => setWarning(null)}
                />
            )}

            {renderGroup('send', 'Отправить в МойСклад', 'up')}
            {renderGroup('receive', 'Получить из МойСклад', 'down')}

            {failed?.state.error && (
                <StatusBanner
                    data-testid="ms-error"
                    title={failed.state.error.title}
                    detail={failed.state.error.detail}
                    onClose={failed.closeBanner}
                />
            )}
        </div>
    )
}
