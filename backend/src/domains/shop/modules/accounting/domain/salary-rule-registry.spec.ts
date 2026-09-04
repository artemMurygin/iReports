import { shopSalaryRuleRegistry } from './salary-rule-registry';
import { PayPerHourShopEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from './entities/salary-rules/product-sold.entity';
import { UsedProductSoldEntity } from './entities/salary-rules/used-product-sold.entity';
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
    });

    it('не содержит лишних типов (Фаза 13 — PayPerHour, ProductSold, UsedProductSold)', () => {
        expect(shopSalaryRuleRegistry.size).toBe(3);
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
