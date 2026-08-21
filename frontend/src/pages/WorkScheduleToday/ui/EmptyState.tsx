import { Users } from 'lucide-react'

export type EmptyStateProps = {
    className?: string
}

/**
 * Показывается, когда `GET /v1/work-schedule/shift` вернул пустой список и на смену, и вне
 * смены — сотрудников в компании нет вообще (справочник Bitrix пуст/ещё не синхронизирован).
 * Тот же повод и тот же приём, что и у `ScheduleEmptyState` десктопной вкладки
 * (`pages/WorkSchedule/ui/ScheduleEmptyState.tsx`) — своя копия, а не импорт: `pages` не может
 * импортировать `pages` (frontend/CLAUDE.md).
 */
export function EmptyState({ className }: EmptyStateProps) {
    return (
        <div data-slot="work-schedule-today-empty-state" className={className}>
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface px-6 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
                    <Users className="size-5 text-ok-ink" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <h2 className="font-display text-sm font-bold tracking-[-0.2px] text-ink">Сотрудников не найдено</h2>
                    <p className="max-w-[280px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                        В справочнике сотрудников пока никого нет.
                    </p>
                </div>
            </div>
        </div>
    )
}
