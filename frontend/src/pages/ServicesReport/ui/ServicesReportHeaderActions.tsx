import { Download } from 'lucide-react'

import type { ServiceAnalyticsEntry } from '@/kernel/types'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { downloadServicesReportCsv } from '../model/exportServicesReportCsv.ts'

export type ServicesReportHeaderActionsProps = {
    services: ServiceAnalyticsEntry[]
}

/**
 * Правая часть шапки `/services` — кнопка «Экспорт» (см. `PageHeader`'s `actions`-слот,
 * `frontend/CLAUDE.md`'s "Слоты вместо children"). CSV строится на клиенте из уже загруженного
 * `services` (`model/exportServicesReportCsv.ts`) — в контракте нет отдельного эндпоинта
 * серверной генерации CSV, поэтому кнопка недоступна, пока список услуг пуст (тот же приём, что
 * и `pages/SalaryReportV2/ui/DepartmentReportHeaderActions.tsx`).
 */
export function ServicesReportHeaderActions({ services }: ServicesReportHeaderActionsProps) {
    return (
        <Button
            variant="secondary"
            size="sm"
            disabled={services.length === 0}
            onClick={() => downloadServicesReportCsv(services)}
        >
            <Download />
            Экспорт
        </Button>
    )
}
