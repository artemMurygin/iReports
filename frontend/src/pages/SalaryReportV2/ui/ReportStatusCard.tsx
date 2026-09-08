import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/tw'

/**
 * Общая карточка-заглушка тела отчёта ("не выбран сотрудник/отдел", "нет данных за период") —
 * один и тот же вид использовали `EmployeeReportBodyV2` и `DepartmentReportBodyV2` (изначально
 * каждый со своей копией разметки), вынесено сюда, чтобы не дублировать её при следующих правках.
 */
export function EmptyStateCard({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-xl border border-hairline bg-surface p-6 text-center', className)}>
            <p className="font-ui text-sm text-ink-muted">{children}</p>
        </div>
    )
}

/** Та же карточка-заглушка, но для сообщения об ошибке запроса — красный текст вместо приглушённого. */
export function ErrorStateCard({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-xl border border-hairline bg-surface p-6 text-center', className)}>
            <p className="font-ui text-sm text-danger">{children}</p>
        </div>
    )
}
