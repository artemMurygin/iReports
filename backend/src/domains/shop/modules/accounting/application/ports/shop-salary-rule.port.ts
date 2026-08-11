import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';

// Зеркало domains/service/modules/accounting/application/ports/
// salary-rule.port.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop. Порт объявляет только реально используемую операцию
// (сейчас — только insert из CreateShopSalaryRuleHandler). Методы вроде
// findAll/delete добавляются сюда, когда появляется конкретный вызывающий
// код, а не заранее.
export interface ShopSalaryRuleRepositoryPort {
    insert(
        entity: ShopSalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void>;
}

export const SHOP_SALARY_RULE_REPOSITORY = Symbol(
    'SHOP_SALARY_RULE_REPOSITORY',
);
