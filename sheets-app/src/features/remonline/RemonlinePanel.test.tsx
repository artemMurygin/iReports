import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemonlinePanel } from './RemonlinePanel'
import type { GlassLoaderController } from '@/shared/gsheets-ui/useGlassLoaderController'
import { gas } from '@/shared/gas'
import { TooltipProvider } from '@/shared/ui/tooltip'
import type { StatusColor } from '@/shared/gsheets-ui/StatusLine'

// RemonlinePanel talks to the server only through `gas` — mocking that boundary keeps these
// tests off the network. Same pattern as MoySkladPanel.test.tsx.
vi.mock('@/shared/gas', () => ({
    gas: {
        uploadPricesToRO: vi.fn(),
        getAccrualsSheetEntries: vi.fn(),
        fetchServiceBonusesMap: vi.fn(),
        applyAccrualsUpdates: vi.fn(),
        getServiceCategories: vi.fn(),
        writeCategoryPathToActiveCell: vi.fn(),
        getCreateServiceRows: vi.fn(),
        createServiceInRoapp: vi.fn(),
        writeCreateServiceResult: vi.fn(),
    },
}))

// InfoTooltip (rendered alongside the still-stubbed create-services button) requires a
// TooltipProvider ancestor — App.tsx supplies one at the root; tests supply it here directly.
function renderPanel(loader: GlassLoaderController, onStatus: (message: string, color: StatusColor) => void) {
    return render(
        <TooltipProvider>
            <RemonlinePanel loader={loader} onStatus={onStatus} />
        </TooltipProvider>,
    )
}

function createLoader(): GlassLoaderController {
    return {
        active: false,
        statusText: '',
        logLines: [],
        show: vi.fn(),
        update: vi.fn(),
        addLog: vi.fn(),
        hide: vi.fn(),
    }
}

describe('RemonlinePanel', () => {
    beforeEach(() => {
        vi.mocked(gas.uploadPricesToRO).mockReset()
        vi.mocked(gas.getAccrualsSheetEntries).mockReset()
        vi.mocked(gas.fetchServiceBonusesMap).mockReset()
        vi.mocked(gas.applyAccrualsUpdates).mockReset()
        vi.mocked(gas.getServiceCategories).mockReset()
        vi.mocked(gas.writeCategoryPathToActiveCell).mockReset()
        vi.mocked(gas.getCreateServiceRows).mockReset()
        vi.mocked(gas.createServiceInRoapp).mockReset()
        vi.mocked(gas.writeCreateServiceResult).mockReset()
    })

    it('renders the 5-stat summary box with no error styling when errors is 0', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.uploadPricesToRO).mockResolvedValue({
            success: true,
            count: { total: 10, valid: 9, create: 3, update: 6, errors: 0 },
        })

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '⬆ Загрузить цены в RO' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('✅ Цены выгружены в Ремонлайн!', 'success')
        })

        expect(screen.getByText('Всего:')).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument()
        expect(screen.getByText('Валидных:')).toBeInTheDocument()
        expect(screen.getByText('9')).toBeInTheDocument()
        expect(screen.getByText('Создано:')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('Обновлено:')).toBeInTheDocument()
        expect(screen.getByText('6')).toBeInTheDocument()
        expect(screen.getByText('Ошибок:')).toBeInTheDocument()
        expect(screen.getByText('0')).toBeInTheDocument()

        const summaryBox = screen.getByText('Всего:').closest('div')?.parentElement
        expect(summaryBox?.className).not.toContain('border-brand-orange')
    })

    it('renders the summary box with error styling when errors > 0', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.uploadPricesToRO).mockResolvedValue({
            success: false,
            count: { total: 10, valid: 9, create: 3, update: 4, errors: 2 },
        })

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '⬆ Загрузить цены в RO' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('❌ Выгрузка завершилась с ошибкой', 'error')
        })

        const summaryBox = screen.getByText('Всего:').closest('div')?.parentElement
        expect(summaryBox?.className).toContain('border-brand-orange')
    })

    it('shows the red error status and does not render the summary box on a rejected uploadPricesToRO', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.uploadPricesToRO).mockRejectedValue(new Error('Сеть недоступна'))

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '⬆ Загрузить цены в RO' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('❌ Сеть недоступна', 'error')
        })

        expect(screen.queryByText('Всего:')).not.toBeInTheDocument()
    })

    it('shows a success message listing updated ids for a non-empty accruals result', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.getAccrualsSheetEntries).mockResolvedValue([])
        vi.mocked(gas.fetchServiceBonusesMap).mockResolvedValue({})
        vi.mocked(gas.applyAccrualsUpdates).mockResolvedValue(['101', '202'])

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '⬇ Обновить начисления мастеров в Таблице' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('✅ Обновлено начислений: 2 (ID: 101, 202)', 'success')
        })
    })

    it('shows the "no changes found" message for an empty accruals result', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.getAccrualsSheetEntries).mockResolvedValue([])
        vi.mocked(gas.fetchServiceBonusesMap).mockResolvedValue({})
        vi.mocked(gas.applyAccrualsUpdates).mockResolvedValue([])

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '⬇ Обновить начисления мастеров в Таблице' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('✅ Готово, изменений не найдено', 'success')
        })
    })

    it('shows the red error status when a step in the accruals chain rejects', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.getAccrualsSheetEntries).mockResolvedValue([])
        vi.mocked(gas.fetchServiceBonusesMap).mockRejectedValue(new Error('RemOnline недоступен'))

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '⬇ Обновить начисления мастеров в Таблице' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('❌ RemOnline недоступен', 'error')
        })
        expect(gas.applyAccrualsUpdates).not.toHaveBeenCalled()
    })

    it('loads categories once on opening the add-service panel and renders the root-level select', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([
            { id: 2, name: 'Диагностика', parentId: null },
            { id: 1, name: 'Ремонт', parentId: null },
        ])

        renderPanel(createLoader(), vi.fn())
        await user.click(screen.getByRole('button', { name: '➕ Добавить новую услугу' }))

        await waitFor(() => {
            expect(screen.getAllByRole('combobox')).toHaveLength(1)
        })
        // Root options sorted by ru locale ('Диагностика' before 'Ремонт').
        const options = screen.getAllByRole('option').map((option) => option.textContent)
        expect(options).toEqual(['— выберите —', 'Диагностика', 'Ремонт'])
        expect(gas.getServiceCategories).toHaveBeenCalledTimes(1)
    })

    it('reveals the next cascade level only when the selected category has children', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([
            { id: 1, name: 'Ремонт', parentId: null },
            { id: 2, name: 'Диагностика', parentId: null }, // leaf, no children
            { id: 10, name: 'iPhone', parentId: 1 },
        ])

        renderPanel(createLoader(), vi.fn())
        await user.click(screen.getByRole('button', { name: '➕ Добавить новую услугу' }))
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1))

        await user.selectOptions(screen.getAllByRole('combobox')[0], '1')
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2))

        await user.selectOptions(screen.getAllByRole('combobox')[0], '2')
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1))
    })

    it('shows a warning and does not call gas when saving with no category selected', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([{ id: 1, name: 'Ремонт', parentId: null }])

        renderPanel(createLoader(), vi.fn())
        await user.click(screen.getByRole('button', { name: '➕ Добавить новую услугу' }))
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1))

        await user.click(screen.getByRole('button', { name: 'Записать категорию' }))

        expect(await screen.findByText('⚠️ Выберите категорию')).toBeInTheDocument()
        expect(gas.writeCategoryPathToActiveCell).not.toHaveBeenCalled()
    })

    it('writes the selected category path to the active cell and shows a success status', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([
            { id: 1, name: 'Ремонт', parentId: null },
            { id: 10, name: 'iPhone', parentId: 1 },
        ])
        vi.mocked(gas.writeCategoryPathToActiveCell).mockResolvedValue('OK')

        renderPanel(createLoader(), vi.fn())
        await user.click(screen.getByRole('button', { name: '➕ Добавить новую услугу' }))
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1))

        await user.selectOptions(screen.getAllByRole('combobox')[0], '1')
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2))
        await user.selectOptions(screen.getAllByRole('combobox')[1], '10')

        await user.click(screen.getByRole('button', { name: 'Записать категорию' }))

        await waitFor(() => {
            expect(gas.writeCategoryPathToActiveCell).toHaveBeenCalledWith('Ремонт > iPhone')
        })
        expect(await screen.findByText('✅ Категория записана в ячейку')).toBeInTheDocument()
    })

    it('shows a warning status and makes no per-row calls when there are no rows to create', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([])
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([])

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '🛠 Создать услуги в Ремонлайн' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('⚠️ Нет строк со значением "Создать" в столбце ID', 'warning')
        })
        expect(gas.createServiceInRoapp).not.toHaveBeenCalled()
    })

    it('processes rows sequentially, writing errors back to the sheet without aborting the loop', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([{ id: 1, name: 'Ремонт', parentId: null }])
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([
            {
                row: 5,
                deviceType: 'Смартфон',
                deviceModel: 'iPhone 13',
                partQuality: 'Оригинал',
                name: 'Замена экрана',
                category: 'Ремонт',
                warranty: 12,
                warrantyPeriod: 'мес.',
                modelNumber: '',
                engineerBonus: 500,
                price: 1000,
            },
            {
                // Missing required "name" -> buildCreateServicePayload throws, no gas.createServiceInRoapp call.
                row: 6,
                deviceType: 'Смартфон',
                deviceModel: 'iPhone 13',
                partQuality: 'Оригинал',
                name: '',
                category: 'Ремонт',
                warranty: 12,
                warrantyPeriod: 'мес.',
                modelNumber: '',
                engineerBonus: 500,
                price: 1000,
            },
        ])
        vi.mocked(gas.createServiceInRoapp).mockResolvedValue({ entityId: 999 })
        vi.mocked(gas.writeCreateServiceResult).mockResolvedValue('OK')

        renderPanel(createLoader(), onStatus)
        await user.click(screen.getByRole('button', { name: '🛠 Создать услуги в Ремонлайн' }))

        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('⚠️ Завершено с ошибками', 'warning')
        })

        expect(gas.createServiceInRoapp).toHaveBeenCalledTimes(1)
        expect(gas.writeCreateServiceResult).toHaveBeenNthCalledWith(1, 5, 999)
        expect(gas.writeCreateServiceResult).toHaveBeenNthCalledWith(
            2,
            6,
            'ОШИБКА: Не заполнены поля: Наименование услуги (J)',
        )

        expect(screen.getByText('Обработано:')).toBeInTheDocument()
        expect(screen.getByText('Создано:')).toBeInTheDocument()
        expect(screen.getByText('Ошибок:')).toBeInTheDocument()
        const summaryBox = screen.getByText('Обработано:').closest('div')?.parentElement
        expect(summaryBox?.textContent).toBe('Обработано: 2Создано: 1Ошибок: 1')
        expect(summaryBox?.className).toContain('border-brand-orange')
    })

    it('shares the cached category tree between the add-service panel and the bulk create flow, fetching it once', async () => {
        const user = userEvent.setup()
        const onStatus = vi.fn()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([{ id: 1, name: 'Ремонт', parentId: null }])
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([
            {
                row: 5,
                deviceType: 'Смартфон',
                deviceModel: 'iPhone 13',
                partQuality: 'Оригинал',
                name: 'Замена экрана',
                category: 'Ремонт',
                warranty: 12,
                warrantyPeriod: 'мес.',
                modelNumber: '',
                engineerBonus: 500,
                price: 1000,
            },
        ])
        vi.mocked(gas.createServiceInRoapp).mockResolvedValue({ entityId: 999 })
        vi.mocked(gas.writeCreateServiceResult).mockResolvedValue('OK')

        renderPanel(createLoader(), onStatus)

        // First feature: opens the add-service panel, triggering the initial category-tree fetch.
        await user.click(screen.getByRole('button', { name: '➕ Добавить новую услугу' }))
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1))
        expect(gas.getServiceCategories).toHaveBeenCalledTimes(1)

        // Second feature: bulk create should reuse the already-cached tree, not refetch it.
        await user.click(screen.getByRole('button', { name: '🛠 Создать услуги в Ремонлайн' }))
        await waitFor(() => {
            expect(onStatus).toHaveBeenCalledWith('✅ Все услуги созданы!', 'success')
        })

        expect(gas.getServiceCategories).toHaveBeenCalledTimes(1)
        expect(gas.createServiceInRoapp).toHaveBeenCalledTimes(1)
    })
})
