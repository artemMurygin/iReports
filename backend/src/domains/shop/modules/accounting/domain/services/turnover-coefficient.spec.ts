import { resolveTurnoverCoefficient } from './turnover-coefficient';

// tasks.md задача 7.1 (openspec/changes/add-department-head-salary-rules, design.md Decision 6b/D8):
// формула дублирует TurnoverCoefficient.calculate (domains/shop/modules/warehouse), но независимо —
// accounting/shop не импортирует warehouse (root CLAUDE.md). moy_sklad_turnover_report_lines не
// хранит коэффициент (в отличие от service), поэтому TurnoverReportRepository (shop) вычисляет его
// при чтении, сравнивая текущий и предыдущий период.
describe('resolveTurnoverCoefficient', () => {
    // FR4: нет строки за предыдущий период (первый месяц данных/новая категория) -> null, не 0
    it('null, если нет данных за предыдущий период', () => {
        expect(resolveTurnoverCoefficient(1000, null, 500)).toBeNull();
    });

    // FR4: средний остаток равен нулю -> null (деление на ноль не выполняется)
    it('null, если средний остаток равен нулю', () => {
        expect(resolveTurnoverCoefficient(1000, 0, 0)).toBeNull();
    });

    // FR4: turnoverSum / ((prev + curr) / 2)
    it('считает оборот делённый на средний остаток', () => {
        // avg(100, 100) = 100 -> 200 / 100 = 2
        expect(resolveTurnoverCoefficient(200, 100, 100)).toBe(2);
    });
});
