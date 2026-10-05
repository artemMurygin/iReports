import { FuncCard } from '@/shared/gsheets-ui/FuncCard'
import type { FuncCardStatus } from '@/shared/gsheets-ui/FuncCard'
import { GroupLabel } from '@/shared/gsheets-ui/GroupLabel'
import { ResultCard } from '@/shared/gsheets-ui/ResultCard'
import { SectionHeader } from '@/shared/gsheets-ui/SectionHeader'
import { StatusBanner } from '@/shared/gsheets-ui/StatusBanner'
import { useOperationStore } from '@/features/operations/operationContext'
import type { OperationState } from '@/features/operations/operationContext'
import { CategoryWriterCard } from './CategoryWriterCard'
import { REMONLINE_FUNCTIONS } from './remonlineFunctions'
import type { RemonlineFunction, RemonlineFunctionId } from './remonlineFunctions'
import { useRemonlineActions } from './useRemonlineActions'
import type { AccrualsResult, CreateServicesSummary } from './useRemonlineActions'
import type { UploadPricesToRoCount } from '@/shared/gas/types'

function formatTime(epoch: number): string {
    const d = new Date(epoch)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** The number shown in the success footer, when the result has one. */
function resultCount(id: RemonlineFunctionId, result: unknown): number | undefined {
    if (!result) return undefined
    if (id === 'ro.uploadPrices') return (result as UploadPricesToRoCount).total
    if (id === 'ro.createServices') return (result as CreateServicesSummary).created
    return (result as AccrualsResult).updated
}

function cardStatus(id: RemonlineFunctionId, state: OperationState): FuncCardStatus {
    const time = state.finishedAt ? formatTime(state.finishedAt) : ''
    if (state.status === 'success') return { state: 'success', time, count: resultCount(id, state.result) }
    if (state.status === 'error') return { state: 'error', time }
    return { state: 'idle' }
}

/**
 * Implements FR3, FR4, FR7, FR8, UX3, UX4 of sheets-app-redesign: the "Ремонлайн" tab. Three FuncCards grouped by
 * direction, a per-function result block (Q15), an error/warning banner and the «Записать категорию в ячейку»
 * card. Reproduces the reference sidebar's behaviour (frontend/GoogleSheetsInterface/index.html, lines ~774-1134).
 */
export function RemonlinePanel() {
    const { anyRunning } = useOperationStore()
    const { warning, setWarning, operations, handlers, category } = useRemonlineActions()

    const failed = Object.values(operations)
        .filter((op) => op.state.status === 'error' && op.state.bannerOpen && op.state.error)
        .sort((a, b) => (b.state.finishedAt ?? 0) - (a.state.finishedAt ?? 0))[0]

    function renderResult(id: RemonlineFunctionId) {
        const { state } = operations[id]
        if (state.result === undefined || state.result === null) return null
        if (state.status !== 'success' && state.status !== 'error') return null

        if (id === 'ro.uploadPrices') {
            const c = state.result as UploadPricesToRoCount
            return (
                <ResultCard
                    data-testid="ro-summary"
                    title="Итог загрузки цен"
                    badge={c.errors > 0 ? 'errors' : 'success'}
                    stats={[
                        { label: 'Всего', value: c.total },
                        { label: 'Валидных', value: c.valid },
                        { label: 'Создано', value: c.create },
                        { label: 'Обновлено', value: c.update },
                        { label: 'Ошибок', value: c.errors },
                    ]}
                />
            )
        }
        if (id === 'ro.createServices') {
            const c = state.result as CreateServicesSummary
            return (
                <ResultCard
                    data-testid="ro-create-summary"
                    title="Итог создания услуг"
                    badge={c.errors > 0 ? 'errors' : 'success'}
                    stats={[
                        { label: 'Всего', value: c.total },
                        { label: 'Создано', value: c.created },
                        { label: 'Ошибок', value: c.errors },
                    ]}
                />
            )
        }
        return null
    }

    function renderGroup(group: RemonlineFunction['group'], label: string, direction: 'up' | 'down') {
        return (
            <>
                <GroupLabel direction={direction}>{label}</GroupLabel>
                {REMONLINE_FUNCTIONS.filter((fn) => fn.group === group).map((fn) => {
                    const { state } = operations[fn.id]
                    const run = () => void handlers[fn.id]()
                    return (
                        <div key={fn.id} className="flex flex-col gap-3">
                            <FuncCard
                                data-testid={fn.id}
                                title={fn.title}
                                description={fn.description}
                                tile={fn.tile}
                                tooltip={fn.tooltip}
                                status={cardStatus(fn.id, state)}
                                disabled={anyRunning}
                                onRun={run}
                                onRetry={run}
                            />
                            {renderResult(fn.id)}
                        </div>
                    )
                })}
            </>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {warning && (
                <StatusBanner
                    data-testid="ro-warning"
                    variant="warning"
                    title={warning.title}
                    detail={warning.detail}
                    onClose={() => setWarning(null)}
                />
            )}

            {renderGroup('send', 'Отправить в Ремонлайн', 'up')}
            {renderGroup('receive', 'Получить из Ремонлайн', 'down')}

            {failed?.state.error && (
                <StatusBanner
                    data-testid="ro-error"
                    title={failed.state.error.title}
                    detail={failed.state.error.detail}
                    onClose={failed.closeBanner}
                />
            )}

            <SectionHeader className="mt-2">Утилиты</SectionHeader>
            <h3 className="text-sm font-bold text-foreground">Записать категорию в ячейку</h3>
            <CategoryWriterCard
                tree={category.tree}
                loadStatus={category.loadStatus}
                loadError={category.loadError}
                selection={category.selection}
                saveStatus={category.saveStatus}
                saveBusy={category.saveBusy}
                canSave={category.canSave}
                disabled={anyRunning}
                onLevelChange={category.onLevelChange}
                onSave={() => void category.onSave()}
                onRetryLoad={category.onRetryLoad}
            />
        </div>
    )
}
