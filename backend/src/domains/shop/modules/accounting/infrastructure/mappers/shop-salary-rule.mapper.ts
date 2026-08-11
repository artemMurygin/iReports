import {
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { Entity } from '@/shared/domain/entity.base';
import { shopSalaryRuleRegistry } from '@/domains/shop/modules/accounting/domain/salary-rule-registry';
import {
    ShopSalaryRule,
    ShopSalaryRuleTypes,
} from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { targetRoleSchema } from 'ireports-contracts';
import {
    shopSalaryRuleConfigSchemaByType,
    shopSalaryRuleTypeSchema,
} from '../schemas/shop-salary-rule.schema';

// Зеркало domains/service/modules/accounting/infrastructure/mappers/
// salary-rule.mapper.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop.
//
// Направление (record.direction) здесь не проверяется намеренно —
// фильтрация "только правила shop" происходит на уровне Prisma-запроса в
// ShopMotivationSchemaRepository (`include: { rules: { where: { direction:
// 'shop' } } }`), поэтому сюда в норме не попадают чужие строки. Если
// попадут (например, прямой вызов в обход репозитория) —
// shopSalaryRuleRegistry.get(type) всё равно не найдёт класс для
// незнакомого/чужого типа и бросит осмысленную ошибку ниже, а не молча
// проглотит чужое правило.
export class ShopSalaryRuleMapper implements Mapper<
    ShopSalaryRule,
    Omit<Prisma.SalaryRuleUncheckedCreateInput, 'motivationSchemaId'>
> {
    toDomain(record: SalaryRuleRecord): ShopSalaryRule {
        const type = shopSalaryRuleTypeSchema.parse(
            record.type,
        ) as ShopSalaryRuleTypes;
        const RuleClass = shopSalaryRuleRegistry.get(type);
        if (!RuleClass) {
            throw new Error(
                `Не удалось определить класс зарплатного правила для типа: ${type}`,
            );
        }
        const configSchema = shopSalaryRuleConfigSchemaByType[type];
        if (!configSchema) {
            throw new Error(
                `Нет схемы конфига для зарегистрированного типа правила: ${type}`,
            );
        }
        const config = configSchema.parse(record.props);
        const targetRole = targetRoleSchema.parse(record.targetRole);

        return new RuleClass({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: { name: record.name, type, targetRole, config },
        });
    }
    toPersistence(
        entity: ShopSalaryRule,
    ): Omit<Prisma.SalaryRuleUncheckedCreateInput, 'motivationSchemaId'> {
        const { createdAt, updatedAt } = entity as unknown as Entity<unknown>;

        return {
            id: entity.id,
            type: entity.type,
            name: entity.name,
            targetRole: entity.targetRole,
            // Направление правила (Фаза 12) — фиксированное 'shop' для
            // этого мапера: домен shop никогда не пишет чужие правила.
            // См. комментарий у SalaryRule.direction в salary.prisma —
            // почему это поле не на MotivationSchema.
            direction: 'shop',
            props: entity.config as Prisma.InputJsonValue,
            createdAt,
            updatedAt,
        };
    }
}
