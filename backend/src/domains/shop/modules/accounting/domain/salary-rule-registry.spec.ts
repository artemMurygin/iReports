import { shopSalaryRuleRegistry } from './salary-rule-registry';
import { PayPerHourShopEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from './entities/salary-rules/product-sold.entity';
import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';

describe('shopSalaryRuleRegistry', () => {
    it('регистрирует классы правил магазина по их типу', () => {
        expect(shopSalaryRuleRegistry.get('PayPerHour')).toBe(
            PayPerHourShopEntity,
        );
        expect(shopSalaryRuleRegistry.get('ProductSold')).toBe(
            ProductSoldEntity,
        );
    });

    it('не содержит лишних типов (Фаза 12 — только PayPerHour и ProductSold)', () => {
        expect(shopSalaryRuleRegistry.size).toBe(2);
    });

    // issue #61: "GET списка типов правил возвращает разные наборы для
    // service и shop; типы правил сервиса и магазина не пересекаются" —
    // здесь проверяется базовая предпосылка этого требования: реестры
    // независимы (разные Map, разные классы), даже когда содержат один и
    // тот же строковый тип ('PayPerHour').
    it('это отдельная Map от salaryRuleRegistry сервиса', () => {
        expect(shopSalaryRuleRegistry).not.toBe(salaryRuleRegistry);
        expect(shopSalaryRuleRegistry.get('PayPerHour')).not.toBe(
            salaryRuleRegistry.get('PayPerHour'),
        );
    });
});
