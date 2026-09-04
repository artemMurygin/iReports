import { cn } from '@/shared/lib/tw'

import type { ServiceAccountRow } from '../model/useServiceAccountsPage.ts'
import { ServiceAccountsRow } from './ServiceAccountsRow.tsx'

export type ServiceAccountsListProps = {
    rows: ServiceAccountRow[]
    totalCount: number
    hasEmployees: boolean
    hasVisibleRows: boolean
    pendingEmployeeId?: number
    onToggle: (employeeId: number, employeeName: string, nextIsServiceAccount: boolean) => void
    className?: string
}

/**
 * Список сотрудников с переключателем «исключить из зарплаты» (docs/employee-ordering-and-salary-filter,
 * Фаза 4). Плоский список, а не таблица с колонками (как `IdentityTable`) — здесь всего два
 * содержательных поля на строку (сотрудник, переключатель), отдельная колонка "заголовков" не
 * несёт информации.
 */
function ServiceAccountsList({
    rows,
    totalCount,
    hasEmployees,
    hasVisibleRows,
    pendingEmployeeId,
    onToggle,
    className,
}: ServiceAccountsListProps) {
    if (!hasEmployees) {
        return (
            <div
                data-slot="service-accounts-empty"
                className={cn('rounded-xl border border-hairline bg-surface px-6 py-10 text-center', className)}
            >
                <p className="font-display text-sm font-bold text-ink">Сотрудников нет</p>
                <p className="mt-1.5 font-ui text-sm text-ink-muted">Справочник Bitrix24 пока пуст.</p>
            </div>
        )
    }

    if (!hasVisibleRows) {
        return (
            <div
                data-slot="service-accounts-empty"
                className={cn('rounded-xl border border-hairline bg-surface px-6 py-10 text-center', className)}
            >
                <p className="font-display text-sm font-bold text-ink">Ничего не найдено</p>
                <p className="mt-1.5 font-ui text-sm text-ink-muted">Измените поисковый запрос.</p>
            </div>
        )
    }

    return (
        <div
            data-slot="service-accounts-list"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            {rows.map((row) => (
                <ServiceAccountsRow
                    key={row.employee.id}
                    row={row}
                    isPending={pendingEmployeeId === row.employee.id}
                    onToggle={onToggle}
                />
            ))}

            <div className="flex h-11 items-center justify-between gap-2 border-t border-hairline bg-canvas px-3.5">
                <span className="font-ui text-xs text-ink-muted">
                    Показаны {rows.length} из {totalCount}
                </span>
                <span className="font-ui text-xs text-ink-muted">
                    Служебные аккаунты не попадают в зарплату, взаиморасчёты и зарплатные схемы
                </span>
            </div>
        </div>
    )
}

export { ServiceAccountsList }
