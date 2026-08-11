import {
    isSalesPerformancePlanApproved,
    toSalesPerformanceSummary,
} from './to-sales-performance-summary';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

const buildFakePerformance = (planStatus: 'CREATED' | 'APPROVED') =>
    ({
        getDepartment: () => 1,
        getCategory: () => null,
        getPlan: () => ({
            turnover: 1000,
            margin: 200,
            status: planStatus,
        }),
        getFact: () => ({
            getTurnover: () => 600,
            getMargin: () => 120,
            getPercentCompletion: () => 60,
        }),
        getPrognose: () => ({
            getTurnover: () => 900,
            getMargin: () => 180,
        }),
    }) as unknown as SalesPerformance;

describe('toSalesPerformanceSummary', () => {
    it('null, если плана/факта нет', () => {
        expect(toSalesPerformanceSummary(null)).toBeNull();
    });

    it('строит компактный блок план/факт/прогноз без похода в БД', () => {
        const performance = buildFakePerformance('APPROVED');
        expect(toSalesPerformanceSummary(performance)).toEqual({
            department: 1,
            category: null,
            plan: { turnover: 1000, margin: 200 },
            fact: { turnover: 600, margin: 120 },
            prognose: { turnover: 900, margin: 180 },
            percentCompletion: 60,
        });
    });
});

describe('isSalesPerformancePlanApproved', () => {
    it('нет плана вообще — считается утверждённым (не блокирует ничего)', () => {
        expect(isSalesPerformancePlanApproved(null)).toBe(true);
    });

    it('план CREATED — не утверждён', () => {
        expect(
            isSalesPerformancePlanApproved(buildFakePerformance('CREATED')),
        ).toBe(false);
    });

    it('план APPROVED — утверждён', () => {
        expect(
            isSalesPerformancePlanApproved(buildFakePerformance('APPROVED')),
        ).toBe(true);
    });
});
