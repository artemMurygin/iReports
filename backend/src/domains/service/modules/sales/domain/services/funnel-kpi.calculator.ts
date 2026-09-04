import { FunnelStageMap } from '../value-objects/funnel-stage-map.value-object';
import { ServiceFunnelKpi } from '../value-objects/service-funnel-kpi.value-object';

// Минимальный набор полей сделки, нужный расчёту KPI — то же, что
// DealForKPI в легаси reports.helpers.ts (stage?.id, opportunity), но не
// завязано на форму DealListItemEntity: application-слой сам решает, как
// достать stageId/opportunity из read-модели (см. GetServiceFunnelReportService).
export interface FunnelDealFacts {
    stageId: string | null;
    opportunity: number | null;
}

// Перенос serviceFunnelKPICalculation (src/TODO/reports/reports.helpers.ts)
// без изменения бизнес-правила (см. "Не в скоупе" PRD: "изменение бизнес-
// логики... переносится как есть") — та же арифметика, тот же порядок
// накопления счётчиков, но группировка этапов теперь идёт через
// FunnelStageMap.classify() вместо четырёх захардкоженных массивов и двух
// строковых литералов ('WON'/'3') инлайн.
//
// spec: service/sales#requirement-целевыенецелевые-лиды-и-группа-воронки-независимые-классификации
// spec: service/sales#requirement-классификация-сделки-воронки-по-ровно-одной-группе
export function calculateServiceFunnelKpi(
    deals: readonly FunnelDealFacts[],
    stageMap: FunnelStageMap,
): ServiceFunnelKpi {
    const counts = {
        nonTargetDeals: 0,
        targetedLeads: 0,
        won: 0,
        lose: 0,
        inWork: 0,
        waitingInService: 0,
        inService: 0,
        revenue: 0,
    };

    for (const deal of deals) {
        const group = stageMap.classify(deal.stageId);

        if (group === 'nonTarget') {
            counts.nonTargetDeals++;
        } else {
            counts.targetedLeads++;
        }

        switch (group) {
            case 'won':
                counts.won++;
                counts.revenue += deal.opportunity ?? 0;
                break;
            case 'lose':
                counts.lose++;
                break;
            case 'inWork':
                counts.inWork++;
                break;
            case 'waitingInService':
                counts.waitingInService++;
                break;
            case 'inService':
                counts.inService++;
                break;
            default:
                break;
        }
    }

    const allLeads = deals.length;
    const conversionRate =
        counts.targetedLeads > 0
            ? Math.round((counts.won / counts.targetedLeads) * 1000) / 10
            : 0;
    const avgDeal =
        counts.won > 0 ? Math.round(counts.revenue / counts.won) : 0;

    return ServiceFunnelKpi.create({
        allLeads,
        nonTargetDeals: counts.nonTargetDeals,
        targetedLeads: counts.targetedLeads,
        won: counts.won,
        lose: counts.lose,
        inWork: counts.inWork,
        waitingInService: counts.waitingInService,
        inService: counts.inService,
        conversionRate,
        avgDeal,
        revenue: counts.revenue,
    });
}
