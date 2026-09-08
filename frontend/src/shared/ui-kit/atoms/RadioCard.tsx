import { cn } from '@/shared/lib/tw'

export type RadioCardProps = {
    selected: boolean
    title: string
    description?: string
    onSelect?: () => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node inside `tSYIw` (`Зарплатное правило ·
 * Создание (Сервис)`) → `Блок · Цель` → `Варианты` → `Option Отдел`/`Option Сотрудник` — a
 * full-width selectable card: 18px circular radio (unselected: `surface` fill, 1.5px `ink-faint`
 * border, no dot; selected: 1.5px `brand-strong` border with an 8px `brand-strong` dot) next to a
 * title (13px/600 `ink`) + description (11px/400 `ink-muted`) stack. Selected state also fills
 * the whole card `brand-soft` with a `brand-border` outline (unselected: `surface`/`hairline`).
 *
 * A radio *button*, not `<input type="radio">` — the design's "Отдел"/"Сотрудник" pair (and the
 * mockup's other card-shaped option lists, e.g. award-type pickers in later phases) is a set of
 * big clickable cards rather than native radio dots with separate labels, so the whole card is
 * the hit target (`role="radio"` on a `<button>`, group semantics — `aria-checked`/exclusivity —
 * owned by the consumer composing a list of these, same division of responsibility as
 * `Checkbox`'s selection-state-lives-in-the-caller convention).
 */
function RadioCard({ selected, title, description, onSelect, className }: RadioCardProps) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            data-slot="radio-card"
            data-selected={selected || undefined}
            className={cn(
                'flex w-full items-center gap-2.5 rounded-[10px] border p-[11px_12px] text-left transition-colors',
                selected ? 'border-brand-border bg-brand-soft' : 'border-hairline bg-surface hover:bg-canvas',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] bg-surface',
                    selected ? 'border-brand-strong' : 'border-ink-faint',
                )}
            >
                {selected && <span className="size-2 rounded-full bg-brand-strong" />}
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-ui text-[13px] font-semibold text-ink">{title}</span>
                {description && <span className="font-ui text-[11px] font-normal text-ink-muted">{description}</span>}
            </span>
        </button>
    )
}

export { RadioCard }
