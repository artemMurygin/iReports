import { Users, Wallet } from 'lucide-react'
import type { ClosePeriodPreviewResponse } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

export type CloseDialogKpiGridProps = {
    preview: ClosePeriodPreviewResponse
}

/**
 * 2 контрольные цифры окна подтверждения (Pencil `GUo20`/`KPPJ5`, ряд из `ERP/Molecule/
 * KPI Card` на десктопе и `ERP/Mobile/KPI Card` на мобильном): сотрудники (с числом
 * уволенных) и фонд оплаты. Карточки «Без часов (PayPerHour)» и «Неутверждённых строк
 * плана» из прежней версии дизайна убраны — вторая дублировала перечень ниже
 * (`UnapprovedRowsList`).
 */
function CloseDialogKpiGrid({ preview }: CloseDialogKpiGridProps) {
    return (
        <div className="grid grid-cols-2 gap-3">
            <KpiCard
                label={
                    <>
                        Сотрудников<span className="hidden sm:inline"> к начислению</span>
                    </>
                }
                value={String(preview.employeesCount)}
                note={`из них уволены: ${preview.dismissedEmployeesCount}`}
                icon={<Users />}
            />
            <KpiCard
                label="Фонд оплаты"
                value={formatCurrency(preview.totalAmount)}
                note="Итог за период"
                icon={<Wallet />}
            />
        </div>
    )
}

export { CloseDialogKpiGrid }
