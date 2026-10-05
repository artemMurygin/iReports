// Implements FR1, FR5, FR9, UX3, UX5, UX6 of sheets-app-redesign: render-smoke and keyboard tests for primitives.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Button } from './button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Badge } from './badge'
import { Progress } from './progress'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { IconButton } from './icon-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

describe('shared/ui primitives', () => {
    it('Button: ink variant, run size and block', () => {
        // FR2: black block button
        render(
            <Button variant="ink" size="run" block>
                Запустить
            </Button>,
        )
        const btn = screen.getByRole('button', { name: 'Запустить' })
        expect(btn).toHaveAttribute('data-variant', 'ink')
        expect(btn.className).toContain('w-full')
    })

    it('Tabs: segment variant switches by keyboard', async () => {
        // FR1: Header tabs
        const user = userEvent.setup()
        render(
            <Tabs defaultValue="a">
                <TabsList variant="segment">
                    <TabsTrigger value="a">Мой склад</TabsTrigger>
                    <TabsTrigger value="b">Ремонлайн</TabsTrigger>
                </TabsList>
                <TabsContent value="a">A</TabsContent>
                <TabsContent value="b">B</TabsContent>
            </Tabs>,
        )
        await user.tab()
        await user.keyboard('{ArrowRight}')
        expect(screen.getByRole('tab', { name: 'Ремонлайн' })).toHaveAttribute('data-state', 'active')
    })

    it('Tooltip: opens on focus', async () => {
        // FR5: tooltip opens on focus
        const user = userEvent.setup()
        render(
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>i</TooltipTrigger>
                    <TooltipContent variant="rich">Описание</TooltipContent>
                </Tooltip>
            </TooltipProvider>,
        )
        await user.tab()
        expect((await screen.findAllByText('Описание')).length).toBeGreaterThan(0)
    })

    it('Badge renders its variant', () => {
        render(<Badge variant="success">Готово</Badge>)
        expect(screen.getByText('Готово')).toHaveAttribute('data-variant', 'success')
    })

    it('Progress: determinate and indeterminate', () => {
        // FR9, Q4
        const { rerender } = render(<Progress value={43} aria-label="Прогресс" />)
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '43')
        rerender(<Progress aria-label="Прогресс" />)
        expect(screen.getByRole('progressbar')).toHaveAttribute('data-indeterminate')
        expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    })

    it('Dialog: Esc calls onOpenChange(false)', async () => {
        // UX5
        const user = userEvent.setup()
        const onOpenChange = vi.fn()
        render(
            <Dialog open onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogTitle>Выгружаем цены</DialogTitle>
                    <DialogDescription>Не закрывайте таблицу</DialogDescription>
                    <button>Отмена</button>
                </DialogContent>
            </Dialog>,
        )
        expect(screen.getByRole('dialog', { name: 'Выгружаем цены' })).toBeInTheDocument()
        await user.keyboard('{Escape}')
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('Popover: opens on click, closes on repeated click and Esc', async () => {
        // FR1, Q14
        const user = userEvent.setup()
        render(
            <Popover>
                <PopoverTrigger>Справка</PopoverTrigger>
                <PopoverContent>Описание приложения</PopoverContent>
            </Popover>,
        )
        await user.click(screen.getByRole('button', { name: 'Справка' }))
        expect(screen.getByText('Описание приложения')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Справка' }))
        expect(screen.queryByText('Описание приложения')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Справка' }))
        await user.keyboard('{Escape}')
        expect(screen.queryByText('Описание приложения')).not.toBeInTheDocument()
    })

    it('IconButton keeps aria-label', () => {
        // UX6
        render(<IconButton aria-label="Справка">i</IconButton>)
        expect(screen.getByRole('button', { name: 'Справка' })).toHaveAttribute('type', 'button')
    })

    it('Select: placeholder, keyboard selection of a name-only item', async () => {
        // UX3, Q16
        const user = userEvent.setup()
        const onValueChange = vi.fn()
        render(
            <Select onValueChange={onValueChange}>
                <SelectTrigger aria-label="Категория">
                    <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Ремонт">Ремонт</SelectItem>
                    <SelectItem value="Замена">Замена</SelectItem>
                </SelectContent>
            </Select>,
        )
        expect(screen.getByText('Выберите услугу')).toBeInTheDocument()
        const trigger = screen.getByRole('combobox', { name: 'Категория' })
        trigger.focus()
        await user.keyboard('{Enter}')
        await user.click(await screen.findByRole('option', { name: 'Замена' }))
        expect(onValueChange).toHaveBeenCalledWith('Замена')
    })
})
