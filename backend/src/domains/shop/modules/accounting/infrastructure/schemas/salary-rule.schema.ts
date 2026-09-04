import { z } from 'zod';
import {
    payPerHourShopSalaryConfigSchema,
    productSoldSalaryConfigSchema,
    usedProductSoldSalaryConfigSchema,
} from 'ireports-contracts';
import { shopSalaryRuleRegistry } from '@/domains/shop/modules/accounting/domain/salary-rule-registry';

// Зеркало domains/service/modules/accounting/infrastructure/schemas/
// salary-rule.schema.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop. Схемы конфига берём из ireports-contracts, а не
// дублируем руками: конфиг правила — одни и те же данные от HTTP-запроса
// до jsonb-колонки `props` в БД без трансформаций (см.
// ShopSalaryRuleMapper.toDomain).
//
// Partial<Record<...>>, а не `as const`: ключ типа — ShopSalaryRuleTypes из
// contracts, а перечень реализованных схем конфига держится отдельно.
// Partial заставляет вызывающий код (ShopSalaryRuleMapper.toDomain) явно
// проверить `undefined`, а не молча получить `any` на несуществующем ключе.
export const shopSalaryRuleConfigSchemaByType: Partial<
    Record<string, z.ZodTypeAny>
> = {
    PayPerHour: payPerHourShopSalaryConfigSchema,
    ProductSold: productSoldSalaryConfigSchema,
    UsedProductSold: usedProductSoldSalaryConfigSchema,
};

// Список типов берём из ключей реестра, а не хардкодим второй раз — так
// zod-enum не может рассинхронизироваться с shopSalaryRuleRegistry.
export const shopSalaryRuleTypeSchema = z.enum(
    Array.from(shopSalaryRuleRegistry.keys()) as [string, ...string[]],
);
