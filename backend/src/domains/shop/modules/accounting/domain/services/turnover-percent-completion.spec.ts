import { resolveTurnoverPercentCompletion } from './turnover-percent-completion';

// tasks.md задача 9.1 (openspec/changes/add-department-head-salary-rules, architecture.md
// "resolveTurnoverPercentCompletion") — зеркало
// domains/service/modules/accounting/domain/services/turnover-percent-completion.spec.ts для shop:
// процент выполнения плана коэффициента оборачиваемости, вход DepartmentTurnoverBonusEntity (shop,
// FR4).
describe('resolveTurnoverPercentCompletion', () => {
    // FR4: факт недоступен (TurnoverPerformanceReaderPort/SHOP_TURNOVER_PERFORMANCE_READER не
    // нашёл коэффициента) -> null, не 0
    it('null, если факт недоступен', () => {
        expect(resolveTurnoverPercentCompletion(null, 1)).toBeNull();
    });

    // FR4: (factRatio / planRatio) * 100
    it('считает процент выполнения плана коэффициента оборачиваемости', () => {
        expect(resolveTurnoverPercentCompletion(1.5, 1)).toBe(150);
        expect(resolveTurnoverPercentCompletion(0.5, 1)).toBe(50);
    });

    it('факт равен нулю — 0%, не null', () => {
        expect(resolveTurnoverPercentCompletion(0, 1)).toBe(0);
    });

    it('план не обязательно равен 1 — общий случай деления', () => {
        expect(resolveTurnoverPercentCompletion(3, 2)).toBe(150);
    });
});
