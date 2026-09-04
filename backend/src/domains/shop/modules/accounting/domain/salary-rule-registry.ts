import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity';
import { UsedProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/used-product-sold.entity';
import {
    ShopSalaryRuleClass,
    ShopSalaryRuleTypes,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Собственный реестр типов правил магазина (Фаза 12/13, issue #57/#64) —
// независимый от salaryRuleRegistry сервиса (domains/service/modules/
// accounting/domain/salary-rule-registry.ts), несмотря на то, что оба
// используют один и тот же паттерн (Map<type, EntityClass>) и у обоих
// направлений есть совпадающие по названию типы ('PayPerHour'): это две
// РАЗНЫЕ Map, в разных модулях, никогда не смешиваются в рантайме — см.
// комментарий у SalaryRule.direction в prisma/schema/salary.prisma, где
// объясняется, как две этих Map не путаются на уровне персистентности.
export const shopSalaryRuleRegistry = new Map<
    ShopSalaryRuleTypes,
    ShopSalaryRuleClass
>([
    ['PayPerHour', PayPerHourShopEntity],
    ['ProductSold', ProductSoldEntity],
    ['UsedProductSold', UsedProductSoldEntity],
]);
