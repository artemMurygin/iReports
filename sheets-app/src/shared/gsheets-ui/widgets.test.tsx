// Implements FR1, FR3, FR4, FR5, FR6, FR7, UX4, UX6 of sheets-app-redesign: widget tests.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TooltipProvider } from '@/shared/ui/tooltip'
import { AppHeader } from './AppHeader'
import { FuncCard, type FuncCardStatus } from './FuncCard'
import { StatusBanner } from './StatusBanner'
import { ResultCard } from './ResultCard'
import { GroupLabel } from './GroupLabel'
import { SectionHeader } from './SectionHeader'

const tooltip = { title: 'Заголовок подсказки', body: 'Тело подсказки', meta: 'пишет в МойСклад' }

function renderCard(status: FuncCardStatus, extra: Partial<Parameters<typeof FuncCard>[0]> = {}) {
    return render(
        <TooltipProvider>
            <FuncCard
                title="Обновить РЦ"
                description="Описание"
                tile="brand"
                status={status}
                tooltip={tooltip}
                {...extra}
            />
        </TooltipProvider>,
    )
}

describe('AppHeader', () => {
    it('FR1: help button opens popover, closes on Esc and repeated click', async () => {
        const user = userEvent.setup()
        render(<AppHeader />)
        expect(screen.getByText('iRepair · Синхронизация')).toBeInTheDocument()
        const btn = screen.getByRole('button', { name: 'Справка' })
        expect(screen.queryByTestId('app-help')).not.toBeInTheDocument()
        await user.click(btn)
        expect(screen.getByTestId('app-help')).toHaveTextContent(/МойСклад и Ремонлайн/)
        await user.keyboard('{Escape}')
        expect(screen.queryByTestId('app-help')).not.toBeInTheDocument()
        await user.click(btn)
        expect(screen.getByTestId('app-help')).toBeInTheDocument()
        await user.click(btn)
        expect(screen.queryByTestId('app-help')).not.toBeInTheDocument()
    })
})

describe('FuncCard', () => {
    it('FR4: idle shows «ещё не запускалось» and Run calls onRun', async () => {
        const onRun = vi.fn()
        const onRetry = vi.fn()
        renderCard({ state: 'idle' }, { onRun, onRetry })
        expect(screen.getByTestId('func-status')).toHaveTextContent('ещё не запускалось')
        await userEvent.click(screen.getByRole('button', { name: 'Запустить' }))
        expect(onRun).toHaveBeenCalledOnce()
        expect(onRetry).not.toHaveBeenCalled()
    })

    it('FR4: success shows time, optional count and Retry calls onRetry', async () => {
        const onRetry = vi.fn()
        const { rerender } = renderCard({ state: 'success', time: '11:25' }, { onRetry })
        expect(screen.getByTestId('func-status')).toHaveTextContent(/^11:25$/)
        rerender(
            <TooltipProvider>
                <FuncCard
                    title="Обновить РЦ"
                    description="Описание"
                    tile="brand"
                    status={{ state: 'success', time: '11:25', count: 253 }}
                    tooltip={tooltip}
                    onRetry={onRetry}
                />
            </TooltipProvider>,
        )
        expect(screen.getByTestId('func-status')).toHaveTextContent('11:25 · 253')
        await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
        expect(onRetry).toHaveBeenCalledOnce()
    })

    it('FR4: error shows code, red outline retry; status text truncates (UX4)', () => {
        renderCard({ state: 'error', time: '11:26', errorCode: 429 })
        expect(screen.getByTestId('func-status')).toHaveTextContent('11:26 · ошибка 429')
        expect(screen.getByRole('button', { name: 'Повторить' })).toHaveAttribute('data-variant', 'destructive-outline')
        expect(screen.getByText('11:26 · ошибка 429').className).toContain('truncate')
    })

    it('FR4: disabled blocks the button and dims the card', () => {
        renderCard({ state: 'idle' }, { disabled: true })
        expect(screen.getByRole('button', { name: 'Запустить' })).toBeDisabled()
        expect(screen.getByRole('region', { name: 'Обновить РЦ' }).className).toContain('opacity-50')
    })

    it('FR3: tile variant is reflected', () => {
        renderCard({ state: 'idle' }, { tile: 'copper' })
        expect(screen.getByTestId('func-tile')).toHaveAttribute('data-tile', 'copper')
    })

    it('FR5: info dot reveals title, body and meta on focus', async () => {
        renderCard({ state: 'idle' })
        await userEvent.tab()
        const tip = await screen.findByTestId('func-tooltip')
        expect(tip).toHaveTextContent('Заголовок подсказки')
        expect(tip).toHaveTextContent('Тело подсказки')
        expect(tip).toHaveTextContent('пишет в МойСклад')
    })
})

describe('StatusBanner', () => {
    it('FR6: shows title/detail and close calls onClose; announced politely', async () => {
        const onClose = vi.fn()
        render(
            <StatusBanner
                data-testid="banner"
                title="МойСклад ответил 429"
                detail="Слишком много запросов · повторите через минуту"
                onClose={onClose}
            />,
        )
        const banner = screen.getByTestId('banner')
        expect(banner).toHaveAttribute('aria-live', 'polite')
        expect(banner).toHaveTextContent('МойСклад ответил 429')
        expect(banner).toHaveTextContent('повторите через минуту')
        await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('FR6: warning variant without close button', () => {
        render(<StatusBanner variant="warning" title="Выберите файл" />)
        expect(screen.getByRole('status')).toHaveAttribute('data-variant', 'warning')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})

describe('ResultCard', () => {
    it('FR7: renders caller-supplied rows and success badge', () => {
        render(
            <ResultCard
                title="Итог создания услуг"
                stats={[
                    { label: 'Всего', value: 5 },
                    { label: 'Создано', value: 4 },
                    { label: 'Ошибок', value: 1 },
                ]}
                badge="errors"
            />,
        )
        expect(screen.getByRole('region', { name: 'Итог создания услуг' })).toBeInTheDocument()
        expect(screen.getByTestId('stat-Создано')).toHaveTextContent('4')
        expect(screen.queryByTestId('stat-Валидных')).not.toBeInTheDocument()
        expect(screen.getByText('С ошибками')).toBeInTheDocument()
    })

    it('FR7: default badge is «Готово»', () => {
        render(<ResultCard title="Итог" stats={[{ label: 'Всего', value: 1 }]} />)
        expect(screen.getByText('Готово')).toBeInTheDocument()
    })
})

describe('GroupLabel / SectionHeader', () => {
    it('FR3: render their text', () => {
        render(
            <>
                <SectionHeader>Источник данных</SectionHeader>
                <GroupLabel direction="up">Отправить в МойСклад</GroupLabel>
            </>,
        )
        expect(screen.getByRole('heading', { name: 'Источник данных' })).toBeInTheDocument()
        expect(screen.getByTestId('group-label')).toHaveTextContent('Отправить в МойСклад')
    })
})
