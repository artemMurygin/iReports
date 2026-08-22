import { CircleCheck, CircleHelp, TriangleAlert, Users, Wallet } from 'lucide-react'
import type { ClosePeriodPreviewResponse } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

export type CloseDialogKpiGridProps = {
    preview: ClosePeriodPreviewResponse
}

/**
 * 4 контрольные цифры окна подтверждения (Pencil `GUo20`/`KPPJ5`, сетка 2×2 из
 * `ERP/Molecule/KPI Card`): сотрудники (с числом уволенных), фонд оплаты, «Без часов
 * (PayPerHour)» — жёлтое предупреждение, не блокирующее закрытие, и «Неутверждённых
 * строк плана» — зелёная при нуле, красная «закрытие заблокировано» при наличии строк.
 */
function CloseDialogKpiGrid({ preview }: CloseDialogKpiGridProps) {
    const hasUnapproved = preview.unapprovedPlanRows.length > 0

    return (
        <div className="grid grid-cols-2 gap-3">
            <KpiCard
                label="Сотрудников к начислению"
                value={String(preview.employeesCount)}
                note={`из них уволены: ${preview.dismissedEmployeesCount}`}
                icon={<Users />}
            />
            <KpiCard
                label="Фонд оплаты"
                value={formatCurrency(preview.totalAmount)}
                note="сумма по снапшоту периода"
                icon={<Wallet />}
            />
            <KpiCard
                label="Без часов (PayPerHour)"
                value={String(preview.employeesWithoutHours)}
                note="предупреждение · не блокирует закрытие"
                tone="warning"
                className="border-warn/35"
                icon={<CircleHelp />}
            />
            <KpiCard
                label="Неутверждённых строк плана"
                value={String(preview.unapprovedPlanRows.length)}
                note={hasUnapproved ? 'закрытие заблокировано' : 'все строки плана утверждены'}
                tone={hasUnapproved ? 'danger' : 'positive'}
                icon={hasUnapproved ? <TriangleAlert /> : <CircleCheck />}
            />
        </div>
    )
}

export { CloseDialogKpiGrid }
