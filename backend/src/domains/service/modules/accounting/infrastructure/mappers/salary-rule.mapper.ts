import {
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
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
} from '../schemas/salary-rule.schema';

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
            props: entity.config as Prisma.InputJsonValue,
            createdAt,
            updatedAt,
        };
    }
}
