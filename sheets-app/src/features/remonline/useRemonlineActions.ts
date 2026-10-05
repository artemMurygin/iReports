import { useEffect, useState } from 'react'
import { gas } from '@/shared/gas'
import { useOperationStore } from '@/features/operations/operationContext'
import { OperationFailure, OperationSkipped, useOperation } from '@/features/operations/useOperation'
import { getSelectedCategoryPath } from './categoryTree'
import { useCategoryTree } from './useCategoryTree'
import { buildCreateServicePayload } from './createService/validation'
import { REMONLINE_FUNCTIONS } from './remonlineFunctions'
import type { RemonlineFunctionId } from './remonlineFunctions'

/** Result of the bulk create-services run (client-side summary). */
export interface CreateServicesSummary {
    created: number
    errors: number
    total: number
}

/** Result of the accruals run. */
export interface AccrualsResult {
    updated: number
}

export interface CategoryStatus {
    variant: 'success' | 'warning' | 'error'
    message: string
}

export interface RemonlineWarning {
    title: string
    detail?: string
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
}

function progressTitle(id: RemonlineFunctionId): string {
    return REMONLINE_FUNCTIONS.find((fn) => fn.id === id)?.progressTitle ?? ''
}

/**
 * Implements FR3, FR4, FR7, FR8 of sheets-app-redesign: handlers + state of the "Ремонлайн" tab on top of the
 * shared `useOperation` template: price sync to RemOnline, bulk create-services, master accruals sync and the
 * cascading category writer. The category tree is loaded when the tab mounts and shared with the bulk flow.
 * Progress goes through the shared
 * `ProgressModal` (FR9, FR13): status text and cancel for the client loops; the blocking upload gets an
 * indeterminate bar with no status text and no cancel.
 */
export function useRemonlineActions() {
    const { progress } = useOperationStore()
    const uploadPrices = useOperation('ro.uploadPrices')
    const createServices = useOperation('ro.createServices')
    const accruals = useOperation('ro.accruals')

    const [warning, setWarning] = useState<RemonlineWarning | null>(null)

    const { tree: categoryTree, status: categoryStatus, error: categoryError, ensureLoaded } = useCategoryTree()
    /** One entry per rendered cascade level; `null` means "rendered but unselected". */
    const [categorySelection, setCategorySelection] = useState<(number | null)[]>([null])
    const [saveStatus, setSaveStatus] = useState<CategoryStatus | null>(null)
    const [saveBusy, setSaveBusy] = useState(false)

    // FR8: no toggle button, the tree loads as soon as the tab opens.
    useEffect(() => {
        ensureLoaded().catch(() => {
            // surfaced through `categoryStatus` / `categoryError`
        })
    }, [ensureLoaded])

    /** Opens the progress modal for the function and always closes it. */
    async function withProgress<T>(id: RemonlineFunctionId, cancellable: boolean, task: () => Promise<T>): Promise<T> {
        progress.begin(progressTitle(id), { cancellable })
        try {
            return await task()
        } finally {
            progress.end()
        }
    }

    const handleUploadPricesToRO = () => {
        setWarning(null)
        return uploadPrices.run(() =>
            withProgress('ro.uploadPrices', false, async () => {
                const result = await gas.uploadPricesToRO()
                if (!result.success) throw new OperationFailure('Выгрузка завершилась с ошибкой', result.count)
                return result.count
            }),
        )
    }

    const handleUploadMasterAccruals = () => {
        setWarning(null)
        return accruals.run(() =>
            withProgress('ro.accruals', true, async (): Promise<AccrualsResult> => {
                progress.setMessage('Читаем начисления из листа...')
                const entries = await gas.getAccrualsSheetEntries()
                if (progress.isCancelled()) throw new OperationSkipped()

                progress.setMessage('Получаем начисления из RemOnline...')
                const earningsById = await gas.fetchServiceBonusesMap()
                if (progress.isCancelled()) throw new OperationSkipped()

                progress.setMessage('Записываем начисления в лист...')
                const updatedIds = await gas.applyAccrualsUpdates(entries, earningsById)
                return { updated: updatedIds.length }
            }),
        )
    }

    const handleCreateServicesInRoapp = () => {
        setWarning(null)
        return createServices.run(() =>
            withProgress('ro.createServices', true, async (): Promise<CreateServicesSummary> => {
                const tree = await ensureLoaded()
                const rows = await gas.getCreateServiceRows()

                if (rows.length === 0) {
                    setWarning({ title: 'Нет строк со значением «Создать»', detail: 'Проверьте столбец ID в листе' })
                    throw new OperationSkipped()
                }

                let created = 0
                let errors = 0
                progress.setMessage(`Создаём услуги: 0 из ${rows.length}`)

                for (const row of rows) {
                    // FR13: cancel is checked between iterations; rows already written stay written.
                    if (progress.isCancelled()) break

                    try {
                        const payload = buildCreateServicePayload(row, tree)
                        const result = await gas.createServiceInRoapp(payload)
                        await gas.writeCreateServiceResult(row.row, result.entityId)
                        created++
                    } catch (err) {
                        await gas.writeCreateServiceResult(row.row, 'ОШИБКА: ' + errorMessage(err))
                        errors++
                    }
                    progress.setMessage(`Создаём услуги: ${created + errors} из ${rows.length}`)
                }

                return { created, errors, total: created + errors }
            }),
        )
    }

    function handleCategoryLevelChange(level: number, rawValue: string) {
        if (!categoryTree) return

        const value = rawValue === '' ? null : Number(rawValue)
        const next = categorySelection.slice(0, level)
        next.push(value)
        if (value !== null) {
            const children = categoryTree.byParent.get(value) ?? []
            if (children.length > 0) next.push(null)
        }
        setCategorySelection(next)
        setSaveStatus(null)
    }

    /** The last cascade level is a chosen leaf (no unselected level pending). */
    const canSaveCategory = categorySelection.length > 0 && categorySelection[categorySelection.length - 1] !== null

    async function handleSaveCategory() {
        const path = categoryTree ? getSelectedCategoryPath(categorySelection, categoryTree) : ''
        if (!path || !canSaveCategory) {
            setSaveStatus({ variant: 'warning', message: 'Выберите категорию' })
            return
        }

        setSaveBusy(true)
        try {
            await gas.writeCategoryPathToActiveCell(path)
            setSaveStatus({ variant: 'success', message: 'Категория записана в ячейку' })
        } catch (err) {
            setSaveStatus({ variant: 'error', message: errorMessage(err) })
        } finally {
            setSaveBusy(false)
        }
    }

    return {
        warning,
        setWarning,
        operations: { 'ro.uploadPrices': uploadPrices, 'ro.createServices': createServices, 'ro.accruals': accruals },
        handlers: {
            'ro.uploadPrices': handleUploadPricesToRO,
            'ro.createServices': handleCreateServicesInRoapp,
            'ro.accruals': handleUploadMasterAccruals,
        },
        category: {
            tree: categoryTree,
            loadStatus: categoryStatus,
            loadError: categoryError,
            selection: categorySelection,
            saveStatus,
            saveBusy,
            canSave: canSaveCategory,
            onLevelChange: handleCategoryLevelChange,
            onSave: handleSaveCategory,
            onRetryLoad: () => {
                ensureLoaded().catch(() => {})
            },
        },
    }
}
