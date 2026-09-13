import { resolveTurnoverPercentCompletion } from './turnover-percent-completion';

// tasks.md задача 8.1 (openspec/changes/add-department-head-salary-rules, architecture.md
// "resolveTurnoverPercentCompletion"): процент выполнения плана коэффициента оборачиваемости —
// (factRatio / planRatio) * 100, используемый DepartmentTurnoverBonusEntity (FR4) как вход
// resolveFloatPercentMultiplier.
describe('resolveTurnoverPercentCompletion', () => {
    // FR4: factRatio недоступен (недостаточно данных — TurnoverPerformanceReaderPort.findForScope
    // вернул null) -> null, а не 0 (правило ещё не может посчитать множитель)
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
        // 3 / 2 * 100 = 150
        expect(resolveTurnoverPercentCompletion(3, 2)).toBe(150);
    });
});
