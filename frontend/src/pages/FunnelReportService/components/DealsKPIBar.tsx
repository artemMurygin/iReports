import { KpiCard } from '@/pages/FunnelReportService/components/KpiCard.tsx';
import type { DashboardKPI } from '@/pages/FunnelReportService/types.ts';

export function DealsKPIBar({ KPI }: { KPI: Partial<DashboardKPI> }) {
    return (
        <div className="flex gap-2">
            <KpiCard
                label="Всего"
                value={KPI.nonTargetDeals + KPI.targetedLeads}
            />
            <KpiCard
                label="Нецелевые"
                value={KPI.nonTargetDeals ?? ''}
            />
            <KpiCard
                label="Целевые"
                value={KPI.targetedLeads ?? ''}
            />
            <KpiCard
                label="В работе"
                value={KPI.inWork ?? ''}
            />
            <KpiCard
                label="Записаны"
                value={KPI.waitingInService ?? ''}
            />
            <KpiCard
                label="В ремонте"
                value={KPI.inService ?? ''}
            />
            <KpiCard
                label="Успешные"
                value={KPI.won ?? ''}
            />
            <KpiCard
                label="Отказы"
                value={KPI.lose ?? ''}
            />
            <KpiCard
                label="Выручка"
                value={KPI.revenue?.toLocaleString('Ru-ru') ?? ''}
            />
            <KpiCard
                label="Конверсия"
                value={`${KPI.conversionRate ?? ''}%`}
            />
        </ div>
    )
}