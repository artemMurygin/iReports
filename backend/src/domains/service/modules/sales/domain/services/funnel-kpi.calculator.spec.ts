import { FunnelStageMap } from '../value-objects/funnel-stage-map.value-object';
import {
    calculateServiceFunnelKpi,
    FunnelDealFacts,
} from './funnel-kpi.calculator';

// Легаси serviceFunnelKPICalculation (src/TODO/reports/reports.helpers.ts)
// удалена вместе с остальным TODO/reports этой же фазой (Фаза 5, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// эти тесты раньше сравнивали расчёт напрямую с легаси-функцией на тех же
// фикстурах; теперь, когда сравнивать не с чем, ожидаемые числа посчитаны
// вручную по той же формуле (зафиксированы в комментариях к каждому кейсу),
// сама формула не менялась (см. Фаза 4 "Когда готово").
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

    // Числа посчитаны вручную по формуле serviceFunnelKPICalculation (см.
    // комментарий выше): allLeads=13; nonTargetDeals=2 (два stageId === '3');
    // targetedLeads=11; won=2 (revenue 15000+25000=40000); lose=2 (LOSE + '4');
    // inWork=2 (NEW + UC_U52J7C); waitingInService=1 (EXECUTING); inService=2
    // (UC_UPDA02 + UC_EWM3W9); conversionRate=round(2/11*1000)/10=18.2;
    // avgDeal=round(40000/2)=20000.
    it('считает KPI на представительной выборке (по одному-два этапа из каждой группы)', () => {
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
        }).toEqual({
            allLeads: 13,
            nonTargetDeals: 2,
            targetedLeads: 11,
            won: 2,
            lose: 2,
            inWork: 2,
            waitingInService: 1,
            inService: 2,
            conversionRate: 18.2,
            avgDeal: 20000,
            revenue: 40000,
        });
    });

    it('пустой список сделок даёт нулевой KPI без деления на 0', () => {
        const kpi = calculateServiceFunnelKpi([], stageMap);

        expect(kpi.getAllLeads()).toBe(0);
        expect(kpi.getConversionRate()).toBe(0);
        expect(kpi.getAvgDeal()).toBe(0);
        expect(kpi.getRevenue()).toBe(0);
    });

    it('округляет conversionRate до одного знака (won/targetedLeads*100)', () => {
        const deals: FunnelDealFacts[] = [
            { stageId: 'WON', opportunity: 100 },
            { stageId: 'NEW', opportunity: 0 },
            { stageId: 'NEW', opportunity: 0 },
        ];

        const kpi = calculateServiceFunnelKpi(deals, stageMap);

        // conversionRate = round(1/3*1000)/10 = 33.3
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

        const kpi = calculateServiceFunnelKpi(deals, stageMap);

        expect(kpi.getRevenue()).toBe(0);
        expect(kpi.getAvgDeal()).toBe(0);
    });
});
