import { z } from 'zod';
import { ShopMotivationRequestSchema } from 'ireports-contracts';
import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/motivation-target.value-object';

// Зеркало domains/service/modules/accounting/domain/types/
// motivation-schema.types.ts (Фаза 13.5, issue #57) — независимая копия
// для направления shop.
export type CreateShopMotivationSchemaProps = z.infer<
    typeof ShopMotivationRequestSchema
>;

// Вход ShopMotivationSchema.create() — targetType/targetId ещё голые
// примитивы (форма command/DTO), внутри сущности собираются в
// ShopMotivationTarget.
export type ShopMotivationSchemaCreateProps = {
    targetType: string;
    targetId: number;
    name: string;
    rules: ShopSalaryRule[];
};

export type ShopMotivationSchemaProps = {
    target: ShopMotivationTarget;
    name: string;
    rules: ShopSalaryRule[];
};
