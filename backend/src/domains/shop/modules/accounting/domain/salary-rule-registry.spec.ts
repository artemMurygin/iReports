import { shopSalaryRuleRegistry } from './salary-rule-registry';
import { PayPerHourShopEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from './entities/salary-rules/product-sold.entity';
import { UsedProductSoldEntity } from './entities/salary-rules/used-product-sold.entity';
import { TaskCompletionShop } from './entities/salary-rules/task-completion.entity';
import { DepartmentPercentEntity } from './entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from './entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from './entities/salary-rules/department-turnover-bonus.entity';
import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';

describe('shopSalaryRuleRegistry', () => {
    it('регистрирует классы правил магазина по их типу', () => {
        expect(shopSalaryRuleRegistry.get('PayPerHour')).toBe(
            PayPerHourShopEntity,
        );
        expect(shopSalaryRuleRegistry.get('ProductSold')).toBe(
            ProductSoldEntity,
        );
        expect(shopSalaryRuleRegistry.get('UsedProductSold')).toBe(
            UsedProductSoldEntity,
        );
        // Раздел 15 tasks.md (add-task-based-salary-rule).
        expect(shopSalaryRuleRegistry.get('TaskCompletion')).toBe(
            TaskCompletionShop,
        );
        // Implements FR2-FR4 of add-department-head-salary-rules (tasks.md раздел 13).
        expect(shopSalaryRuleRegistry.get('DepartmentPercent')).toBe(
            DepartmentPercentEntity,
        );
        expect(shopSalaryRuleRegistry.get('DepartmentPlanBonus')).toBe(
            DepartmentPlanBonusEntity,
        );
        expect(shopSalaryRuleRegistry.get('DepartmentTurnoverBonus')).toBe(
            DepartmentTurnoverBonusEntity,
        );
    });

    it('не содержит лишних типов (раздел 15 — PayPerHour, ProductSold, UsedProductSold, TaskCompletion; раздел 13 — 3 новых вида уровня отдела)', () => {
        expect(shopSalaryRuleRegistry.size).toBe(7);
    });

    // issue #61: "GET списка типов правил возвращает разные наборы для
    // service и shop; типы правил сервиса и магазина не пересекаются" —
    // здесь проверяется базовая предпосылка этого требования: реестры
    // независимы (разные Map, разные классы), даже когда содержат
    // совпадающие по названию строковые типы ('PayPerHour').
    it('это отдельная Map от salaryRuleRegistry сервиса', () => {
        expect(shopSalaryRuleRegistry).not.toBe(salaryRuleRegistry);
        expect(shopSalaryRuleRegistry.get('PayPerHour')).not.toBe(
            salaryRuleRegistry.get('PayPerHour'),
        );
    });
});
