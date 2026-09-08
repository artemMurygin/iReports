import { Download } from 'lucide-react'

import type { DepartmentReportVM, SalaryReportScope } from '@/features/SalaryReportData'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { downloadDepartmentReportCsv } from '../model/exportDepartmentReportCsv.ts'

export type DepartmentReportHeaderActionsProps = {
    scope: SalaryReportScope
    report: DepartmentReportVM | null
}

/**
 * Правая часть шапки `/salaries` (отчёт отдела/сотрудников) — кнопка «Выгрузить CSV» (Pencil-диф
 * `o2fTU/cDc6b`). Симметрична `EmployeeReportHeaderActions` (та рендерится только в
 * `scope === 'employee'`, эта — только в `scope === 'department'`), обе рендерятся рядом в
 * `actions`-слоте `PageHeader` (`frontend/CLAUDE.md`'s "Слоты вместо children") — так ветвление по
 * `scope` остаётся внутри презентационных компонентов, а не в `SalaryReportV2Page` ("медиатор/
 * страница без `&&`/тернарников").
 *
 * CSV строится на клиенте из уже загруженного `report` (`model/exportDepartmentReportCsv.ts`) — в
 * контракте нет отдельного эндпоинта серверной генерации CSV, поэтому кнопка недоступна, пока отчёт
 * не загружен (`report === null`).
 */
export function DepartmentReportHeaderActions({ scope, report }: DepartmentReportHeaderActionsProps) {
    if (scope !== 'department') {
        return null
    }

    return (
        <Button variant="secondary" disabled={!report} onClick={() => report && downloadDepartmentReportCsv(report)}>
            <Download />
            Выгрузить CSV
        </Button>
    )
}
