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
                    record.targetType,
                    record.targetId,
                ),
                // serviceName — direction-специфичное имя (см. комментарий
                // в salary.prisma); фолбэк на общий `name` только для строк,
                // заведённых до миграции add_motivation_schema_direction_name
                // (или ни разу не создававшихся/переименовывавшихся со
                // стороны service).
                name: record.serviceName ?? record.name,
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
            // `name` — legacy-колонка, заполняется для обратной
            // совместимости (историческое значение первой строки); реально
            // читаемое service-направлением имя — serviceName ниже.
            name: props.name,
            serviceName: props.name,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
