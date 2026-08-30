import { toSalesPerformanceContext } from './to-sales-performance-context';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

// Режим расчёта FACT | PROGNOSE в контексте (Фаза 9, issue #42): в режиме
// PROGNOSE правило должно получить SalesPrognose.percentCompletion вместо
// SalesFact.percentCompletion, всё остальное (department/category)
// идентично — единственное отличие между двумя проходами calculate().
const buildFakePerformance = (
    factPercent: number,
    prognosePercent: number,
): SalesPerformance =>
    ({
        getDepartment: () => 1,
        getCategory: () => null,
        getFact: () => ({ getPercentCompletion: () => factPercent }),
        getPrognose: () => ({ getPercentCompletion: () => prognosePercent }),
    }) as unknown as SalesPerformance;

describe('toSalesPerformanceContext', () => {
    it('null, если SalesPerformance ещё не посчитан (нет плана/факта)', () => {
        expect(toSalesPerformanceContext(null, 'FACT')).toBeNull();
        expect(toSalesPerformanceContext(null, 'PROGNOSE')).toBeNull();
    });

    it('режим FACT — берёт SalesFact.percentCompletion', () => {
        const performance = buildFakePerformance(60, 90);
        expect(toSalesPerformanceContext(performance, 'FACT')).toEqual({
            department: 1,
            category: null,
            percentCompletion: 60,
        });
    });

    it('режим PROGNOSE — берёт SalesPrognose.percentCompletion, а не факт', () => {
        const performance = buildFakePerformance(60, 90);
        expect(toSalesPerformanceContext(performance, 'PROGNOSE')).toEqual({
            department: 1,
            category: null,
            percentCompletion: 90,
        });
    });
});
