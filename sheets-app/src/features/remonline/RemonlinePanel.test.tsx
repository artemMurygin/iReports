// Implements FR3, FR4, FR7, FR8, UX3 of sheets-app-redesign: tests of the "Ремонлайн" tab.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemonlinePanel } from './RemonlinePanel'
import { OperationProvider } from '@/features/operations/OperationProvider'
import { gas } from '@/shared/gas'
import { TooltipProvider } from '@/shared/ui/tooltip'

// RemonlinePanel talks to the server only through `gas` — mocking that boundary keeps these
// tests off the network. Same pattern as MoySkladPanel.test.tsx.
// OperationProvider asks the backend for the last cron price import on open; this panel has no use for it.
vi.mock('@/shared/gas/progressStream', () => ({
    fetchLastScheduledImport: () => Promise.resolve(null),
}))

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

function renderPanel() {
    return render(
        <TooltipProvider>
            <OperationProvider>
                <RemonlinePanel />
            </OperationProvider>
        </TooltipProvider>,
    )
}

function runButton(id: string) {
    return within(screen.getByTestId(id)).getByRole('button', { name: /Запустить|Повторить/ })
}

const GOOD_ROW = {
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
}
const BAD_ROW = {
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
}

describe('RemonlinePanel', () => {
    beforeEach(() => {
        for (const fn of Object.values(gas)) vi.mocked(fn).mockReset()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([{ id: 1, name: 'Ремонт', parentId: null }])
    })

    it('FR3: three idle cards in two direction groups', () => {
        renderPanel()

        expect(screen.getAllByTestId('group-label').map((el) => el.textContent)).toEqual([
            'Отправить в Ремонлайн',
            'Получить из Ремонлайн',
        ])
        for (const id of ['ro.uploadPrices', 'ro.createServices', 'ro.accruals']) {
            expect(screen.getByTestId(id)).toHaveAttribute('data-status', 'idle')
        }
        expect(screen.getByTestId('ro.createServices')).toHaveTextContent('Создать услуги в Ремонлайн')
    })

    it('FR7: shows the 5-row result block with a success badge after uploadPricesToRO', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.uploadPricesToRO).mockResolvedValue({
            success: true,
            count: { total: 10, valid: 9, create: 3, update: 6, errors: 0 },
        })

        renderPanel()
        await user.click(runButton('ro.uploadPrices'))

        const summary = await screen.findByTestId('ro-summary')
        expect(summary).toHaveAccessibleName('Итог загрузки цен')
        expect(within(summary).getByText('Готово')).toBeInTheDocument()
        expect(within(screen.getByTestId('stat-Всего')).getByText('10')).toBeInTheDocument()
        expect(within(screen.getByTestId('stat-Валидных')).getByText('9')).toBeInTheDocument()
        expect(within(screen.getByTestId('stat-Создано')).getByText('3')).toBeInTheDocument()
        expect(within(screen.getByTestId('stat-Обновлено')).getByText('6')).toBeInTheDocument()
        expect(within(screen.getByTestId('stat-Ошибок')).getByText('0')).toBeInTheDocument()
        expect(screen.getByTestId('ro.uploadPrices')).toHaveAttribute('data-status', 'success')
    })

    it('FR4, FR7: success=false marks the card as error, keeps the result block with an errors badge', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.uploadPricesToRO).mockResolvedValue({
            success: false,
            count: { total: 10, valid: 9, create: 3, update: 4, errors: 2 },
        })

        renderPanel()
        await user.click(runButton('ro.uploadPrices'))

        await waitFor(() => expect(screen.getByTestId('ro.uploadPrices')).toHaveAttribute('data-status', 'error'))
        expect(within(screen.getByTestId('ro-summary')).getByText('С ошибками')).toBeInTheDocument()
        expect(screen.getByTestId('ro-error')).toHaveTextContent(/Выгрузка завершилась с ошибкой/)
    })

    it('FR6: a rejected uploadPricesToRO shows the error banner and no result block', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.uploadPricesToRO).mockRejectedValue(new Error('Сеть недоступна'))

        renderPanel()
        await user.click(runButton('ro.uploadPrices'))

        expect(await screen.findByTestId('ro-error')).toHaveTextContent(/Сеть недоступна/)
        expect(screen.queryByTestId('ro-summary')).not.toBeInTheDocument()

        // closing the banner does not clear the card's own error
        await user.click(within(screen.getByTestId('ro-error')).getByRole('button', { name: 'Закрыть' }))
        expect(screen.queryByTestId('ro-error')).not.toBeInTheDocument()
        expect(screen.getByTestId('ro.uploadPrices')).toHaveAttribute('data-status', 'error')
    })

    it('FR4: accruals success shows the updated count in the card footer', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getAccrualsSheetEntries).mockResolvedValue([])
        vi.mocked(gas.fetchServiceBonusesMap).mockResolvedValue({})
        vi.mocked(gas.applyAccrualsUpdates).mockResolvedValue(['101', '202'])

        renderPanel()
        await user.click(runButton('ro.accruals'))

        await waitFor(() => expect(screen.getByTestId('ro.accruals')).toHaveAttribute('data-status', 'success'))
        expect(within(screen.getByTestId('ro.accruals')).getByTestId('func-status')).toHaveTextContent(/\d\d:\d\d · 2$/)
    })

    it('FR4: accruals without changes still succeeds with a zero count', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getAccrualsSheetEntries).mockResolvedValue([])
        vi.mocked(gas.fetchServiceBonusesMap).mockResolvedValue({})
        vi.mocked(gas.applyAccrualsUpdates).mockResolvedValue([])

        renderPanel()
        await user.click(runButton('ro.accruals'))

        await waitFor(() => expect(screen.getByTestId('ro.accruals')).toHaveAttribute('data-status', 'success'))
        expect(within(screen.getByTestId('ro.accruals')).getByTestId('func-status')).toHaveTextContent(/ · 0$/)
    })

    it('FR6: a failing step of the accruals chain shows the error banner and stops the chain', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getAccrualsSheetEntries).mockResolvedValue([])
        vi.mocked(gas.fetchServiceBonusesMap).mockRejectedValue(new Error('RemOnline недоступен'))

        renderPanel()
        await user.click(runButton('ro.accruals'))

        expect(await screen.findByTestId('ro-error')).toHaveTextContent(/RemOnline недоступен/)
        expect(gas.applyAccrualsUpdates).not.toHaveBeenCalled()
    })

    it('FR8: loads the category tree on mount and renders the root select with a placeholder', async () => {
        vi.mocked(gas.getServiceCategories).mockResolvedValue([
            { id: 2, name: 'Диагностика', parentId: null },
            { id: 1, name: 'Ремонт', parentId: null },
        ])
        const user = userEvent.setup()

        renderPanel()

        const select = await screen.findByRole('combobox', { name: 'Категория, уровень 1' })
        expect(select).toHaveTextContent('Выберите услугу')
        expect(gas.getServiceCategories).toHaveBeenCalledTimes(1)

        await user.click(select)
        // Root options sorted by ru locale ('Диагностика' before 'Ремонт'), names only (Q16).
        expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Диагностика', 'Ремонт'])
    })

    it('FR8: shows a retry button when the category tree fails to load', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockRejectedValueOnce(new Error('нет доступа'))

        renderPanel()

        expect(await screen.findByTestId('ro-category-load-error')).toHaveTextContent(/нет доступа/)
        await user.click(within(screen.getByTestId('ro-category-writer')).getByRole('button', { name: 'Повторить' }))
        expect(await screen.findByRole('combobox', { name: 'Категория, уровень 1' })).toBeInTheDocument()
    })

    it('FR8, UX3: reveals the next cascade level only for a category with children; save needs a leaf', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([
            { id: 1, name: 'Ремонт', parentId: null },
            { id: 2, name: 'Диагностика', parentId: null }, // leaf, no children
            { id: 10, name: 'iPhone', parentId: 1 },
        ])

        renderPanel()
        const save = await screen.findByTestId('ro-save-category')
        expect(save).toBeDisabled()

        await user.click(screen.getByRole('combobox', { name: 'Категория, уровень 1' }))
        await user.click(await screen.findByRole('option', { name: 'Ремонт' }))
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(2))
        expect(save).toBeDisabled()

        await user.click(screen.getByRole('combobox', { name: 'Категория, уровень 1' }))
        await user.click(await screen.findByRole('option', { name: 'Диагностика' }))
        await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1))
        expect(save).toBeEnabled()
    })

    it('FR8: shows the path with " / " and writes it to the cell with " > "', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([
            { id: 1, name: 'Ремонт', parentId: null },
            { id: 10, name: 'iPhone', parentId: 1 },
        ])
        vi.mocked(gas.writeCategoryPathToActiveCell).mockResolvedValue('OK')

        renderPanel()
        await user.click(await screen.findByRole('combobox', { name: 'Категория, уровень 1' }))
        await user.click(await screen.findByRole('option', { name: 'Ремонт' }))
        await user.click(await screen.findByRole('combobox', { name: 'Категория, уровень 2' }))
        await user.click(await screen.findByRole('option', { name: 'iPhone' }))

        expect(screen.getByTestId('ro-category-path')).toHaveTextContent('Ремонт / iPhone')

        await user.click(screen.getByTestId('ro-save-category'))

        await waitFor(() => expect(gas.writeCategoryPathToActiveCell).toHaveBeenCalledWith('Ремонт > iPhone'))
        expect(await screen.findByTestId('ro-category-status')).toHaveTextContent(/Категория записана в ячейку/)
    })

    it('FR4: shows a warning banner, stays idle and makes no per-row calls when there are no rows to create', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getServiceCategories).mockResolvedValue([])
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([])

        renderPanel()
        await user.click(runButton('ro.createServices'))

        expect(await screen.findByTestId('ro-warning')).toHaveTextContent(/Нет строк со значением/)
        expect(screen.getByTestId('ro.createServices')).toHaveAttribute('data-status', 'idle')
        expect(gas.createServiceInRoapp).not.toHaveBeenCalled()
    })

    it('FR7: processes rows sequentially, writing errors back to the sheet without aborting; result block has 3 rows', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([GOOD_ROW, BAD_ROW])
        vi.mocked(gas.createServiceInRoapp).mockResolvedValue({ entityId: 999 })
        vi.mocked(gas.writeCreateServiceResult).mockResolvedValue('OK')

        renderPanel()
        await user.click(runButton('ro.createServices'))

        const summary = await screen.findByTestId('ro-create-summary')
        expect(summary).toHaveAccessibleName('Итог создания услуг')
        expect(within(summary).getByText('С ошибками')).toBeInTheDocument()
        expect(within(summary).getByTestId('stat-Всего')).toHaveTextContent('2')
        expect(within(summary).getByTestId('stat-Создано')).toHaveTextContent('1')
        expect(within(summary).getByTestId('stat-Ошибок')).toHaveTextContent('1')
        expect(within(summary).queryByTestId('stat-Валидных')).not.toBeInTheDocument()
        expect(within(summary).queryByTestId('stat-Обновлено')).not.toBeInTheDocument()

        expect(gas.createServiceInRoapp).toHaveBeenCalledTimes(1)
        expect(gas.writeCreateServiceResult).toHaveBeenNthCalledWith(1, 5, 999)
        expect(gas.writeCreateServiceResult).toHaveBeenNthCalledWith(
            2,
            6,
            'ОШИБКА: Не заполнены поля: Наименование услуги (J)',
        )
    })

    it('FR8: the bulk create flow reuses the tree loaded on mount, fetching it once', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([GOOD_ROW])
        vi.mocked(gas.createServiceInRoapp).mockResolvedValue({ entityId: 999 })
        vi.mocked(gas.writeCreateServiceResult).mockResolvedValue('OK')

        renderPanel()
        await screen.findByRole('combobox', { name: 'Категория, уровень 1' })

        await user.click(runButton('ro.createServices'))
        await waitFor(() => expect(screen.getByTestId('ro.createServices')).toHaveAttribute('data-status', 'success'))

        expect(gas.getServiceCategories).toHaveBeenCalledTimes(1)
        expect(gas.createServiceInRoapp).toHaveBeenCalledTimes(1)
    })

    it('FR9, FR13: create-services shows status and cancel; cancel stops between rows', async () => {
        const user = userEvent.setup()
        vi.mocked(gas.getCreateServiceRows).mockResolvedValue([
            GOOD_ROW,
            { ...GOOD_ROW, row: 7 },
            { ...GOOD_ROW, row: 8 },
        ])
        let release!: () => void
        vi.mocked(gas.createServiceInRoapp).mockImplementation(
            () => new Promise((resolve) => (release = () => resolve({ entityId: 1 } as never))),
        )
        vi.mocked(gas.writeCreateServiceResult).mockResolvedValue(undefined as never)
        renderPanel()
        await waitFor(() => expect(gas.getServiceCategories).toHaveBeenCalled())

        await user.click(runButton('ro.createServices'))
        const modal = await screen.findByTestId('progress-modal')
        expect(within(modal).getByText('Создаём услуги в Ремонлайн')).toBeInTheDocument()
        await waitFor(() =>
            expect(within(modal).getByTestId('progress-message')).toHaveTextContent('Создаём услуги: 0 из 3'),
        )
        await waitFor(() => expect(gas.createServiceInRoapp).toHaveBeenCalledTimes(1))

        await user.click(within(modal).getByRole('button', { name: 'Отмена' }))
        release()

        await waitFor(() => expect(screen.getByTestId('ro.createServices')).toHaveAttribute('data-status', 'success'))
        expect(gas.createServiceInRoapp).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('progress-modal')).not.toBeInTheDocument()
    })

    it('FR9: the blocking upload shows an indeterminate modal without cancel', async () => {
        const user = userEvent.setup()
        let finish!: (v: never) => void
        vi.mocked(gas.uploadPricesToRO).mockImplementation(() => new Promise((resolve) => (finish = resolve)))
        renderPanel()

        await user.click(runButton('ro.uploadPrices'))
        const modal = await screen.findByTestId('progress-modal')
        expect(within(modal).getByText('Выгружаем цены в RO')).toBeInTheDocument()
        expect(within(modal).queryByTestId('progress-message')).not.toBeInTheDocument()
        expect(within(modal).queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()

        finish({ success: true, count: { total: 1, valid: 1, create: 0, update: 1, errors: 0 } } as never)
        await waitFor(() => expect(screen.queryByTestId('progress-modal')).not.toBeInTheDocument())
    })
})
