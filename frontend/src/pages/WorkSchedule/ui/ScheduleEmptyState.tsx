import { Users } from 'lucide-react'

export type ScheduleEmptyStateProps = {
    periodLabel: string
    className?: string
}

/**
 * Показывается, когда `GET /v1/work-schedule` вернул пустой `employees[]` — либо в выбранном
 * отделе нет сотрудников, либо (реже) справочник Bitrix ещё не синхронизирован. PRD, критерий
 * готовности: "для месяца без данных — пустые ячейки без ошибки" — это про заполненность
 * графика, а не про отсутствие сотрудников как таковых, поэтому это отдельный, самостоятельный
 * empty state, а не часть таблицы.
 */
function ScheduleEmptyState({ periodLabel, className }: ScheduleEmptyStateProps) {
    return (
        <div data-slot="work-schedule-empty-state" className={className}>
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft">
                    <Users className="size-6 text-ok-ink" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <h2 className="font-display text-base font-bold tracking-[-0.2px] text-ink">Сотрудников не найдено</h2>
                    <p className="max-w-[360px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                        В выбранном отделе нет сотрудников за {periodLabel}. Попробуйте выбрать другой отдел или месяц.
                    </p>
                </div>
            </div>
        </div>
    )
}

export { ScheduleEmptyState }
