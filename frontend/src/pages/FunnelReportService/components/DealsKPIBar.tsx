import { KpiCard } from '@/pages/FunnelReportService/components/KpiCard.tsx';
import type { DashboardKPI } from '@/pages/FunnelReportService/types.ts';
import { Grid } from '@/shared/ui/Grid';

export function DealsKPIBar({ KPI }: { KPI: Partial<DashboardKPI> }) {
    return (
        <Grid className="gap-2 grid-cols-5 xl:grid-cols-10">
            <KpiCard
                label="Всего"
                value={(KPI.nonTargetDeals ?? '') + (KPI.targetedLeads ?? '')}
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
                value={`${KPI.conversionRate ?? ''} %`}
            />
        </ Grid>
    )
}