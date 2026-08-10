import {
    MotivationSchema as MotivationSchemaRecord,
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationTarget } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { SalaryRuleMapper } from './salary-rule.mapper';

// Правила больше не хранятся в самой строке motivation_schemas (см.
// salary_rules), поэтому чтение схемы обязано приходить с включённой связью.
export type MotivationSchemaRow = MotivationSchemaRecord & {
    rules: SalaryRuleRecord[];
};

export class MotivationSchemaMapper implements Mapper<
    MotivationSchema,
    Prisma.MotivationSchemaCreateInput
> {
    private readonly salaryRuleMapper = new SalaryRuleMapper();

    toDomain(record: MotivationSchemaRow): MotivationSchema {
        return new MotivationSchema({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                target: MotivationTarget.create(
                    record.targetType as 'Department' | 'Employee',
                    record.targetId,
                ),
                name: record.name,
                rules: record.rules.map((rule) =>
                    this.salaryRuleMapper.toDomain(rule),
                ),
            },
        });
    }

    toPersistence(
        entity: MotivationSchema,
    ): Prisma.MotivationSchemaCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            targetType: props.target.getType(),
            targetId: props.target.getId(),
            name: props.name,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
