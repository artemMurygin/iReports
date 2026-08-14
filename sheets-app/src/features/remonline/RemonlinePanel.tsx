import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { InfoTooltip } from '@/shared/gsheets-ui/InfoTooltip'
import { StatusLine, SummaryBox } from '@/shared/gsheets-ui/StatusLine'
import type { StatusColor } from '@/shared/gsheets-ui/StatusLine'
import type { GlassLoaderController } from '@/shared/gsheets-ui/useGlassLoaderController'
import { gas } from '@/shared/gas'
import { getSelectedCategoryPath } from './categoryTree'
import { useCategoryTree } from './useCategoryTree'
import { buildCreateServicePayload } from './createService/validation'

const H4_CLASS = 'my-[1.33em] text-base font-bold'

const UPLOAD_RO_LABEL = '⬆ Загрузить цены в RO'
const UPLOAD_RO_LABEL_BUSY = 'Выгрузка...'
const UPLOAD_ACCRUALS_LABEL = '⬇ Обновить начисления мастеров в Таблице'
const UPLOAD_ACCRUALS_LABEL_BUSY = 'Обновление...'
const CREATE_SERVICES_LABEL = '🛠 Создать услуги в Ремонлайн'
const CREATE_SERVICES_LABEL_BUSY = 'Создание...'
const SAVE_CATEGORY_LABEL = 'Записать категорию'
const SAVE_CATEGORY_LABEL_BUSY = 'Запись...'

const CATEGORY_SELECT_CLASS = 'mb-1.5 block w-full rounded-md border border-[#ccc] bg-white p-2 text-[13px]'

interface RemonlinePanelProps {
    /** Shared glass-loader controller (see `useGlassLoaderController`), owned by `App`. */
    loader: GlassLoaderController
    /** Reports a status-line message + color up to `App`'s bottom `StatusLine`. */
    onStatus: (message: string, color: StatusColor) => void
}

interface RoSummaryState {
    total: number
    valid: number
    create: number
    update: number
    errors: number
}

interface CreateServicesSummaryState {
    created: number
    errors: number
    total: number
}

interface AddServiceStatusState {
    message: string
    color: StatusColor
    /** The reference's loading text is a distinct gray (#888), not the neutral status color (#333). */
    muted?: boolean
}

const ADD_SERVICE_STATUS_IDLE: AddServiceStatusState = { message: '', color: 'neutral' }

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
}

// Reproduces the reference sidebar's "Ремонлайн" tab (frontend/GoogleSheetsInterface/index.html
// uploadPricesToRO/uploadMasterAccruals/toggleAddServiceMenu/saveCategoryToActiveCell/
// createServicesInRoapp, lines ~774-1134): price sync to RemOnline, master accruals sync, the
// cascading add-service category picker, and the bulk create-services flow. The category tree
// (`useCategoryTree`) is loaded once and shared between the add-service panel and the bulk flow,
// mirroring the reference's single module-level `categoryTree`/`categoriesLoaded` state.
export function RemonlinePanel({ loader, onStatus }: RemonlinePanelProps) {
    const [uploadRoBusy, setUploadRoBusy] = useState(false)
    const [uploadAccrualsBusy, setUploadAccrualsBusy] = useState(false)
    const [roSummary, setRoSummary] = useState<RoSummaryState | null>(null)
    const [showAddServicePanel, setShowAddServicePanel] = useState(false)

    const { tree: categoryTree, ensureLoaded: ensureCategoryTreeLoaded } = useCategoryTree()
    /** One entry per rendered cascade level; `null` means "rendered but unselected". */
    const [categorySelection, setCategorySelection] = useState<(number | null)[]>([])
    const [addServiceStatus, setAddServiceStatus] = useState<AddServiceStatusState>(ADD_SERVICE_STATUS_IDLE)
    const [saveCategoryBusy, setSaveCategoryBusy] = useState(false)

    const [createServicesBusy, setCreateServicesBusy] = useState(false)
    const [createServicesSummary, setCreateServicesSummary] = useState<CreateServicesSummaryState | null>(null)

    async function handleUploadPricesToRO() {
        loader.show('Выгружаем цены в Ремонлайн')
        setUploadRoBusy(true)
        onStatus('', 'neutral')
        setRoSummary(null)

        try {
            const result = await gas.uploadPricesToRO()
            loader.hide()
            setRoSummary(result.count)
            onStatus(
                result.success ? '✅ Цены выгружены в Ремонлайн!' : '❌ Выгрузка завершилась с ошибкой',
                result.success ? 'success' : 'error',
            )
        } catch (err) {
            loader.hide()
            onStatus('❌ ' + errorMessage(err), 'error')
        } finally {
            setUploadRoBusy(false)
        }
    }

    async function handleUploadMasterAccruals() {
        loader.show('Обновляем начисления мастеров')
        setUploadAccrualsBusy(true)
        onStatus('', 'neutral')

        try {
            loader.update('Читаем данные из таблицы...')
            loader.addLog('Читаем данные из таблицы...')
            const entries = await gas.getAccrualsSheetEntries()

            loader.update('Запрашиваем начисления из RemOnline...')
            loader.addLog('Запрашиваем начисления из RemOnline...')
            const earningsById = await gas.fetchServiceBonusesMap()

            loader.update('Сравниваем и обновляем таблицу...')
            loader.addLog('Сравниваем и обновляем таблицу...')
            const updatedIds = await gas.applyAccrualsUpdates(entries, earningsById)

            loader.hide()
            if (updatedIds.length) {
                onStatus(
                    '✅ Обновлено начислений: ' + updatedIds.length + ' (ID: ' + updatedIds.join(', ') + ')',
                    'success',
                )
            } else {
                onStatus('✅ Готово, изменений не найдено', 'success')
            }
        } catch (err) {
            loader.hide()
            onStatus('❌ ' + errorMessage(err), 'error')
        } finally {
            setUploadAccrualsBusy(false)
        }
    }

    async function handleToggleAddServicePanel() {
        if (showAddServicePanel) {
            setShowAddServicePanel(false)
            return
        }

        setShowAddServicePanel(true)
        setCategorySelection([])
        setAddServiceStatus(ADD_SERVICE_STATUS_IDLE)

        if (!categoryTree) {
            setAddServiceStatus({ message: 'Загрузка категорий...', color: 'neutral', muted: true })
            try {
                await ensureCategoryTreeLoaded()
                setAddServiceStatus(ADD_SERVICE_STATUS_IDLE)
            } catch (err) {
                setAddServiceStatus({ message: '❌ ' + errorMessage(err), color: 'error' })
                return
            }
        }

        setCategorySelection([null])
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
    }

    async function handleSaveCategory() {
        const path = categoryTree ? getSelectedCategoryPath(categorySelection, categoryTree) : ''
        if (!path) {
            setAddServiceStatus({ message: '⚠️ Выберите категорию', color: 'warning' })
            return
        }

        setSaveCategoryBusy(true)
        try {
            await gas.writeCategoryPathToActiveCell(path)
            setAddServiceStatus({ message: '✅ Категория записана в ячейку', color: 'success' })
        } catch (err) {
            setAddServiceStatus({ message: '❌ ' + errorMessage(err), color: 'error' })
        } finally {
            setSaveCategoryBusy(false)
        }
    }

    async function handleCreateServicesInRoapp() {
        loader.show('Создаём услуги в Ремонлайн')
        setCreateServicesBusy(true)
        onStatus('', 'neutral')
        setCreateServicesSummary(null)

        try {
            loader.update('Загружаем категории услуг...')
            loader.addLog('Загружаем категории услуг...')
            const tree = await ensureCategoryTreeLoaded()

            loader.update('Читаем строки из таблицы...')
            loader.addLog('Читаем строки из таблицы...')
            const rows = await gas.getCreateServiceRows()

            if (rows.length === 0) {
                loader.hide()
                onStatus('⚠️ Нет строк со значением "Создать" в столбце ID', 'warning')
                return
            }

            let created = 0
            let errors = 0

            for (const row of rows) {
                loader.update(`Обработка строки ${row.row} (${created + errors + 1}/${rows.length})...`)

                try {
                    const payload = buildCreateServicePayload(row, tree)
                    const result = await gas.createServiceInRoapp(payload)
                    await gas.writeCreateServiceResult(row.row, result.entityId)
                    created++
                    loader.addLog(`Строка ${row.row}: создано (ID ${result.entityId})`)
                } catch (err) {
                    const message = errorMessage(err)
                    await gas.writeCreateServiceResult(row.row, 'ОШИБКА: ' + message)
                    errors++
                    loader.addLog(`Строка ${row.row}: ошибка — ${message}`)
                }
            }

            loader.hide()
            setCreateServicesSummary({ created, errors, total: rows.length })
            onStatus(
                errors === 0 ? '✅ Все услуги созданы!' : '⚠️ Завершено с ошибками',
                errors === 0 ? 'success' : 'warning',
            )
        } catch (err) {
            loader.hide()
            onStatus('❌ ' + errorMessage(err), 'error')
        } finally {
            setCreateServicesBusy(false)
        }
    }

    return (
        <>
            <h4 className={H4_CLASS}>Синхронизация с Ремонлайн</h4>

            <div className="mb-1 flex flex-col gap-2">
                <Button
                    variant="outline"
                    onClick={handleUploadPricesToRO}
                    disabled={uploadRoBusy}
                    className="h-auto justify-center rounded-lg border-[1.5px] border-brand-green bg-white p-[10px] text-[13px] font-semibold text-brand-green shadow-none hover:bg-brand-green/5 hover:text-brand-green"
                >
                    {uploadRoBusy ? UPLOAD_RO_LABEL_BUSY : UPLOAD_RO_LABEL}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleUploadMasterAccruals}
                    disabled={uploadAccrualsBusy}
                    className="h-auto justify-center rounded-lg border-[1.5px] border-brand-blue bg-white p-[10px] text-[13px] font-semibold text-brand-blue shadow-none hover:bg-brand-blue/5 hover:text-brand-blue"
                >
                    {uploadAccrualsBusy ? UPLOAD_ACCRUALS_LABEL_BUSY : UPLOAD_ACCRUALS_LABEL}
                </Button>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleCreateServicesInRoapp}
                        disabled={createServicesBusy}
                        className="h-auto flex-1 justify-center rounded-lg border-[1.5px] border-brand-orange bg-white p-[10px] text-[13px] font-semibold text-brand-orange shadow-none hover:bg-brand-orange/5 hover:text-brand-orange"
                    >
                        {createServicesBusy ? CREATE_SERVICES_LABEL_BUSY : CREATE_SERVICES_LABEL}
                    </Button>
                    <InfoTooltip>
                        Создаёт услуги в RemOnline для всех строк, где в столбце ID (E) указано «Создать».
                        <br />
                        <br />
                        <b>Обязательные поля:</b> Тип устройства (G), Модель устройства (H), Качество запчасти (I),
                        Наименование услуги (J), Категория (K, формат: Категория &gt; Подкатегория &gt; ... &gt;
                        Последняя), Срок гарантии (L), Период гарантии (M: «дн.» или «мес.»), Начисление мастеру (BU),
                        Цена услуги (AY).
                        <br />
                        <b>Необязательно:</b> Номер модели (N).
                        <br />
                        <br />
                        Название услуги: [Наименование] [Тип устройства] [Модель устройства] [Качество запчасти] ([Номер
                        модели]).
                        <br />
                        <br />
                        После обработки в столбец ID записывается ID созданной услуги либо «ОШИБКА: ...» с описанием
                        проблемы.
                    </InfoTooltip>
                </div>
            </div>

            {/* #createServicesSummary — populated by createServicesInRoapp */}
            <SummaryBox
                stats={
                    createServicesSummary
                        ? [
                              { label: 'Обработано', value: createServicesSummary.total },
                              { label: 'Создано', value: createServicesSummary.created },
                              { label: 'Ошибок', value: createServicesSummary.errors },
                          ]
                        : []
                }
                hasErrors={(createServicesSummary?.errors ?? 0) > 0}
            />
            {/* #roSummary — populated by uploadPricesToRO */}
            {roSummary && (
                <SummaryBox
                    stats={[
                        { label: 'Всего', value: roSummary.total },
                        { label: 'Валидных', value: roSummary.valid },
                        { label: 'Создано', value: roSummary.create },
                        { label: 'Обновлено', value: roSummary.update },
                        { label: 'Ошибок', value: roSummary.errors },
                    ]}
                    hasErrors={roSummary.errors > 0}
                />
            )}

            {showAddServicePanel && (
                <div className="mt-[14px] rounded-lg border border-[#e0e0e0] bg-[#fafafa] p-3">
                    <div>
                        {categoryTree &&
                            categorySelection.map((selectedId, level) => {
                                const parentId = level === 0 ? null : categorySelection[level - 1]
                                const children = (categoryTree.byParent.get(parentId) ?? [])
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

                                return (
                                    <select
                                        key={level}
                                        value={selectedId ?? ''}
                                        onChange={(event) => handleCategoryLevelChange(level, event.target.value)}
                                        className={CATEGORY_SELECT_CLASS}
                                    >
                                        <option value="">— выберите —</option>
                                        {children.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                )
                            })}
                    </div>

                    <Button
                        onClick={handleSaveCategory}
                        disabled={saveCategoryBusy}
                        className="h-auto w-full rounded-md bg-brand-blue p-[9px] text-[13px] font-semibold text-white hover:bg-brand-blue/90"
                    >
                        {saveCategoryBusy ? SAVE_CATEGORY_LABEL_BUSY : SAVE_CATEGORY_LABEL}
                    </Button>

                    <StatusLine
                        message={addServiceStatus.message}
                        color={addServiceStatus.color}
                        className={addServiceStatus.muted ? 'mt-2 text-[#888]' : 'mt-2'}
                    />
                </div>
            )}

            <Button
                variant="outline"
                onClick={handleToggleAddServicePanel}
                className="mt-[10px] h-auto w-full justify-center rounded-lg border-[1.5px] border-brand-green bg-white p-[10px] text-[13px] font-semibold text-brand-green shadow-none hover:bg-brand-green/5 hover:text-brand-green"
            >
                ➕ Добавить новую услугу
            </Button>
        </>
    )
}
