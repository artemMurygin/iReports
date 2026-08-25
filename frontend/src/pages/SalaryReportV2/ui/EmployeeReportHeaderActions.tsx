import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PeriodPicker } from '@/features/SalesPlan'
import type { SalaryReportScope } from '@/features/SalaryReportData'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type EmployeeReportHeaderActionsProps = {
    scope: SalaryReportScope
    period: string
    onPeriodChange: (period: string) => void
}

/**
 * Правая часть шапки `/salaries/employee/:id` — `PeriodPicker` и «Назад к отделу» на одном уровне
 * с заголовком страницы (проп `actions` у `PageHeader`), после того как Фаза 1
 * (`docs/salary-department-first-navigation`) убрала переключатель "Сотрудник"/"Отдел" и `Select`
 * выбора сотрудника, а Фаза 2 добавила саму навигацию назад. Рендерится только в
 * `scope === 'employee'` — на `/salaries` (отчёт отдела) ни того ни другого элемента здесь быть не
 * должно (у отдела свой `PeriodPicker` — в `SalaryReportFiltersV2`), поэтому ветвление живёт здесь,
 * а не в `SalaryReportV2Page` (см. `frontend/CLAUDE.md`'s "медиатор/страница не должен содержать
 * условного рендера").
 *
 * Кнопка "Назад" визуально и структурно повторяет
 * `pages/SalaryAccrualDocument/ui/DocumentHeader.tsx`'s secondary-кнопку "Назад к списку"
 * (`Button variant="secondary"` + `ArrowLeft` из `lucide-react`), но вместо `onBack`-пропа —
 * `<Link>` на статичный `/salaries` (роут по умолчанию — отчёт отдела): сотрудник может попасть на
 * `/salaries/employee/:id` напрямую по ссылке, без `/salaries` в истории браузера, поэтому переход
 * должен явно вести на маршрут, а не полагаться на `navigate(-1)`.
 */
export function EmployeeReportHeaderActions({ scope, period, onPeriodChange }: EmployeeReportHeaderActionsProps) {
    if (scope !== 'employee') {
        return null
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker period={period} onPeriodChange={onPeriodChange} />

            <Button asChild variant="secondary">
                <Link to="/salaries">
                    <ArrowLeft />
                    Назад к отделу
                </Link>
            </Button>
        </div>
    )
}
