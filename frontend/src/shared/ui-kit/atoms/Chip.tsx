import * as React from 'react'
import { X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, узел `sVWu5` (`ERP/Atom/Chip`) — компактная
 * «пилюля» 7px радиуса с рамкой `hairline`, паддингами 10/5 и gap 6: слот иконки 13px цвета
 * `ink-muted` + подпись 12px/500 `ink`. На экране «Связи сотрудников» (фрейм `CpVvw`) чип
 * показывает один идентификатор сотрудника во внешней ERP в формате «Тип · Значение»
 * («ID · 412», «Онлайн-менеджер · Мурыгин А.»).
 *
 * Вариант `ghost` — это «призрачный» плейсхолдер «Связать» из ячейки без связей: у него
 * ровно та же геометрия (радиус, паддинги, gap, размер иконки и подписи), отличаются только
 * заливка (`canvas` вместо `surface`) и приглушённый цвет подписи (`ink-muted` вместо `ink`).
 * Поэтому сделан пропом `variant`, а не отдельным компонентом: дублировать коробку ради двух
 * цветов — значит развести две вёрстки, которые придётся править синхронно.
 *
 * Тег выбирается по наличию `onClick`: с обработчиком это интерактивный элемент (открывает
 * модалку связи), поэтому рендерится `<button type="button">` с focus-ring и hover; без него
 * чип чисто декоративный и рендерится `<span>` — так семантика не врёт скринридеру.
 */
const chipVariants = cva(
    // `[&>svg:first-child]:pointer-events-none` — не блокировать клики на ВСЕХ svg внутри чипа
    // (`[&_svg]`), а только на ведущей декоративной иконке (`icon`-проп, всегда первый ребёнок):
    // иначе съёмный крестик `onRemove` тоже становится некликабельным, и клик по нему "проваливается"
    // на сам чип (открывает Popover вместо сброса) — баг, найденный вживую в Playwright.
    "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-[7px] border border-hairline px-2.5 py-[5px] font-ui text-xs font-medium whitespace-nowrap transition-colors [&>svg:first-child]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[13px]",
    {
        variants: {
            variant: {
                default: 'bg-surface text-ink [&_svg]:text-ink-muted',
                ghost: 'bg-canvas text-ink-muted [&_svg]:text-ink-muted',
            },
            interactive: {
                true: 'outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:text-ink-faint disabled:[&_svg]:text-ink-faint',
                false: '',
            },
        },
        compoundVariants: [
            { variant: 'default', interactive: true, class: 'hover:bg-canvas' },
            { variant: 'ghost', interactive: true, class: 'hover:border-ink-faint hover:text-ink' },
        ],
        defaultVariants: {
            variant: 'default',
            interactive: false,
        },
    },
)

export type ChipProps = {
    /** Иконка (обычно `lucide-react`), 13px по умолчанию — переопределяется классом `size-*`. */
    icon?: React.ReactNode
    children: React.ReactNode
    /** `default` — заполненный чип идентификатора, `ghost` — плейсхолдер «Связать». */
    variant?: NonNullable<VariantProps<typeof chipVariants>['variant']>
    /** Если передан — чип рендерится кнопкой. */
    onClick?: () => void
    /**
     * Кнопка сброса справа от подписи (обычно `<X />`) — рендерится своим отдельным
     * flex-элементом вне обрезаемого `<span className="truncate">`, а не как часть `children`.
     * `children` внутри truncate-обёртки — это текст; добавление к нему ещё и trailing-иконки
     * ломает `text-overflow: ellipsis` (браузер уводит иконку на вторую строку вместо того,
     * чтобы просто обрезать текст, см. баг с крестиком категории в `CategoryTreeSelect`).
     */
    onRemove?: () => void
    disabled?: boolean
    title?: string
    'aria-label'?: string
    className?: string
}

function Chip({ icon, children, variant = 'default', onClick, onRemove, disabled, className, ...props }: ChipProps) {
    const content = (
        <>
            {icon}
            <span className="truncate">{children}</span>
            {onRemove && (
                <X
                    className="size-[13px] shrink-0 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove()
                    }}
                />
            )}
        </>
    )

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                data-slot="chip"
                data-variant={variant}
                className={cn(chipVariants({ variant, interactive: true, className }))}
                {...props}
            >
                {content}
            </button>
        )
    }

    return (
        <span data-slot="chip" data-variant={variant} className={cn(chipVariants({ variant, className }))} {...props}>
            {content}
        </span>
    )
}

export { Chip, chipVariants }
