import type { ServiceFunnelKpiResponse } from 'ireports-contracts';
import { ServiceFunnelKpi } from '../../domain/value-objects/service-funnel-kpi.value-object';

// VO → плоская форма контракта, по образцу to-deal-list-item-response.ts —
// читает значения через геттеры VO, ничего не вычисляет.
export function toServiceFunnelKpiResponse(
    kpi: ServiceFunnelKpi,
): ServiceFunnelKpiResponse {
    return {
        allLeads: kpi.getAllLeads(),
        nonTargetDeals: kpi.getNonTargetDeals(),
        targetedLeads: kpi.getTargetedLeads(),
        won: kpi.getWon(),
        lose: kpi.getLose(),
        inWork: kpi.getInWork(),
        waitingInService: kpi.getWaitingInService(),
        inService: kpi.getInService(),
        conversionRate: kpi.getConversionRate(),
        avgDeal: kpi.getAvgDeal(),
        revenue: kpi.getRevenue(),
    };
}
