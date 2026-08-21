export type PageHeaderProps = {
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Page Header`. Title Block (22px/700
 * Montserrat + 12px `ink-muted` подзаголовок) — тот же текст, что и у десктопного `PageHeader`
 * (`pages/WorkSchedule/ui/PageHeader.tsx`), но без «Today Chip»: мобильный макет его не рисует —
 * выбор дня и так виден в ленте недели ниже.
 */
export function PageHeader({ className }: PageHeaderProps) {
    return (
        <div data-slot="work-schedule-today-page-header" className={className}>
            <h1 className="font-display text-[22px] font-bold tracking-[-0.4px] text-ink">График работы</h1>
            <p className="mt-1.5 font-ui text-xs leading-[1.4] text-ink-muted">
                Кто в какой день работает и сколько часов. Отсюда берутся часы для правила «оплата по часам»
            </p>
        </div>
    )
}
