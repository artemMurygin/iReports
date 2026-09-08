import {
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { Entity } from '@/shared/domain/entity.base';
import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';
import {
    SalaryRule,
    SalaryRuleTypes,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { targetRoleSchema } from 'ireports-contracts';
import {
    salaryRuleConfigSchemaByType,
    salaryRuleTypeSchema,
} from '../../schemas/salary-rule.schema';

// Направление (record.direction) здесь не проверяется намеренно — фильтрация
// "только правила service" происходит на уровне Prisma-запроса в
// MotivationSchemaRepository (Фаза 12, `include: { rules: { where: {
// direction: 'service' } } }`), поэтому сюда в норме не попадают чужие
// строки. Если попадут (например, прямой вызов в обход репозитория) —
// salaryRuleRegistry.get(type) всё равно не найдёт класс для
// незнакомого/чужого типа и бросит осмысленную ошибку ниже, а не молча
// проглотит чужое правило.
export class SalaryRuleMapper implements Mapper<
    SalaryRule,
    Omit<Prisma.SalaryRuleUncheckedCreateInput, 'motivationSchemaId'>
> {
    toDomain(record: SalaryRuleRecord): SalaryRule {
        const type = salaryRuleTypeSchema.parse(record.type) as SalaryRuleTypes;
        const RuleClass = salaryRuleRegistry.get(type);
        if (!RuleClass) {
            throw new Error(
                `Не удалось определить класс зарплатного правила для типа: ${type}`,
            );
        }
        const configSchema = salaryRuleConfigSchemaByType[type];
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
        entity: SalaryRule,
    ): Omit<Prisma.SalaryRuleUncheckedCreateInput, 'motivationSchemaId'> {
        const { createdAt, updatedAt } = entity as unknown as Entity<unknown>;

        return {
            id: entity.id,
            type: entity.type,
            name: entity.name,
            targetRole: entity.targetRole,
            // Направление правила (Фаза 12) — фиксированное 'service' для
            // этого мапера: домен service никогда не пишет чужие правила.
            // См. комментарий у SalaryRule.direction в salary.prisma —
            // почему это поле не на MotivationSchema.
            direction: 'service',
            props: entity.config,
            createdAt,
            updatedAt,
        };
    }
}
