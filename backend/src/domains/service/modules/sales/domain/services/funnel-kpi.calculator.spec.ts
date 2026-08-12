import { serviceFunnelKPICalculation } from '@/TODO/reports/reports.helpers';
import { FunnelStageMap } from '../value-objects/funnel-stage-map.value-object';
import {
    calculateServiceFunnelKpi,
    FunnelDealFacts,
} from './funnel-kpi.calculator';

function toLegacyShape(deal: FunnelDealFacts) {
    return {
        stage: deal.stageId ? { id: deal.stageId } : null,
        opportunity: deal.opportunity,
    };
}

describe('calculateServiceFunnelKpi', () => {
    const stageMap = FunnelStageMap.default();

    // Представительная выборка — по одному-два этапа из каждой легаси-
    // группы (won/lose/inWork/waitingInService/inService/nonTarget) плюс
    // неклассифицированный этап и сделка без stage вовсе.
    const fixtures: FunnelDealFacts[] = [
        { stageId: 'WON', opportunity: 15_000 },
        { stageId: 'WON', opportunity: 25_000 },
        { stageId: 'LOSE', opportunity: 5_000 },
        { stageId: '4', opportunity: 3_000 },
        { stageId: 'NEW', opportunity: 10_000 },
        { stageId: 'UC_U52J7C', opportunity: 7_000 },
        { stageId: 'EXECUTING', opportunity: 12_000 },
        { stageId: 'UC_UPDA02', opportunity: 8_000 },
        { stageId: 'UC_EWM3W9', opportunity: 9_000 },
        { stageId: '3', opportunity: 1_000 },
        { stageId: '3', opportunity: 2_000 },
        { stageId: 'SOME_UNKNOWN_STAGE', opportunity: 500 },
        { stageId: null, opportunity: null },
    ];

    // Прямое сравнение с легаси-функцией (не только с ожидаемыми числами
    // руками) — гарантия того, что перенос в VO/calculator не изменил
    // бизнес-правило (см. "Когда готово" Фазы 4: "KPI на одинаковой
    // выборке сделок совпадает с legacy-расчётом").
    it('совпадает с легаси serviceFunnelKPICalculation на представительной выборке', () => {
        const legacy = serviceFunnelKPICalculation(fixtures.map(toLegacyShape));
        const actual = calculateServiceFunnelKpi(fixtures, stageMap);

        expect({
            allLeads: actual.getAllLeads(),
            nonTargetDeals: actual.getNonTargetDeals(),
            targetedLeads: actual.getTargetedLeads(),
            won: actual.getWon(),
            lose: actual.getLose(),
            inWork: actual.getInWork(),
            waitingInService: actual.getWaitingInService(),
            inService: actual.getInService(),
            conversionRate: actual.getConversionRate(),
            avgDeal: actual.getAvgDeal(),
            revenue: actual.getRevenue(),
        }).toEqual(legacy);
    });

    it('пустой список сделок даёт нулевой KPI без деления на 0', () => {
        const legacy = serviceFunnelKPICalculation([]);
        const kpi = calculateServiceFunnelKpi([], stageMap);

        expect(kpi.getAllLeads()).toBe(0);
        expect(kpi.getConversionRate()).toBe(0);
        expect(kpi.getAvgDeal()).toBe(0);
        expect(kpi.getRevenue()).toBe(0);
        expect(kpi.getConversionRate()).toBe(legacy.conversionRate);
        expect(kpi.getAvgDeal()).toBe(legacy.avgDeal);
    });

    it('округляет conversionRate до одного знака (won/targetedLeads*100)', () => {
        const deals: FunnelDealFacts[] = [
            { stageId: 'WON', opportunity: 100 },
            { stageId: 'NEW', opportunity: 0 },
            { stageId: 'NEW', opportunity: 0 },
        ];

        const legacy = serviceFunnelKPICalculation(deals.map(toLegacyShape));
        const kpi = calculateServiceFunnelKpi(deals, stageMap);

        expect(kpi.getConversionRate()).toBe(legacy.conversionRate);
        expect(kpi.getConversionRate()).toBe(33.3);
    });

    it('avgDeal — среднее opportunity среди WON, округлённое до целого', () => {
        const deals: FunnelDealFacts[] = [
            { stageId: 'WON', opportunity: 10 },
            { stageId: 'WON', opportunity: 15 },
        ];

        const kpi = calculateServiceFunnelKpi(deals, stageMap);

        expect(kpi.getAvgDeal()).toBe(13);
        expect(kpi.getRevenue()).toBe(25);
    });

    it('WON без opportunity (null) не ломает revenue/avgDeal — трактуется как 0', () => {
        const deals: FunnelDealFacts[] = [
            { stageId: 'WON', opportunity: null },
        ];

        const legacy = serviceFunnelKPICalculation(deals.map(toLegacyShape));
        const kpi = calculateServiceFunnelKpi(deals, stageMap);

        expect(kpi.getRevenue()).toBe(legacy.revenue);
        expect(kpi.getAvgDeal()).toBe(legacy.avgDeal);
        expect(kpi.getRevenue()).toBe(0);
        expect(kpi.getAvgDeal()).toBe(0);
    });
});
