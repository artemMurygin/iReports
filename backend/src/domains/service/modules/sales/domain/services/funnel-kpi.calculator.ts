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
// Инвариант легаси-функции сохранён буквально: won/lose/inWork/
// waitingInService/inService не эксклюзивны с targetedLeads/nonTargetDeals
// — это две независимые оси классификации одного и того же stageId
// (целевой/нецелевой И группа воронки), а не единая пятисекционная
// диаграмма. FunnelStageMap.classify() возвращает ОДНУ группу на этих осях
// одновременно, потому что группы 'nonTarget'/'won'/'lose'/'inWork'/
// 'waitingInService'/'inService' в default() взаимно не пересекаются по
// stageId (инвариант проверен в FunnelStageMap.buildLookup) — так каждый
// classify() результат однозначно маппится ровно на один инкремент ниже.
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
