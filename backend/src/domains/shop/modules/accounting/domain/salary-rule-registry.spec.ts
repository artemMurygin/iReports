import { shopSalaryRuleRegistry } from './salary-rule-registry';
import { PayPerHourShopEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from './entities/salary-rules/product-sold.entity';
import { UsedProductSoldEntity } from './entities/salary-rules/used-product-sold.entity';
import { TaskCompletedShopEntity } from './entities/salary-rules/task-completed.entity';
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
        expect(shopSalaryRuleRegistry.get('TaskCompleted')).toBe(
            TaskCompletedShopEntity,
        );
    });

    it('не содержит лишних типов (Фаза 13 — PayPerHour, ProductSold, UsedProductSold, TaskCompleted)', () => {
        expect(shopSalaryRuleRegistry.size).toBe(4);
    });

    // issue #61: "GET списка типов правил возвращает разные наборы для
    // service и shop; типы правил сервиса и магазина не пересекаются" —
    // здесь проверяется базовая предпосылка этого требования: реестры
    // независимы (разные Map, разные классы), даже когда содержат
    // совпадающие по названию строковые типы ('PayPerHour', 'TaskCompleted',
    // Фаза 13).
    it('это отдельная Map от salaryRuleRegistry сервиса', () => {
        expect(shopSalaryRuleRegistry).not.toBe(salaryRuleRegistry);
        expect(shopSalaryRuleRegistry.get('PayPerHour')).not.toBe(
            salaryRuleRegistry.get('PayPerHour'),
        );
        expect(shopSalaryRuleRegistry.get('TaskCompleted')).not.toBe(
            salaryRuleRegistry.get('TaskCompleted'),
        );
    });
});
