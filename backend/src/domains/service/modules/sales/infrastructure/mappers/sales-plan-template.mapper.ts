import {
    SalesPlanTemplate as SalesPlanTemplateRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { SalesPlanTemplate } from '@/domains/service/modules/sales/domain/entities/sales-plan-template.entity';
import { SalesPlanScope } from '@/domains/service/modules/sales/domain/value-objects/sales-plan-scope.value-object';
import { categoryToDomain, categoryToPersistence } from './sales-plan.mapper';

export class SalesPlanTemplateMapper implements Mapper<
    SalesPlanTemplate,
    Prisma.SalesPlanTemplateCreateInput
> {
    toDomain(record: SalesPlanTemplateRecord): SalesPlanTemplate {
        return new SalesPlanTemplate({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                scope: SalesPlanScope.create(
                    record.direction,
                    record.departmentId,
                    categoryToDomain(record.categoryId),
                ),
                turnover: record.turnover,
                margin: record.margin,
                growthPercent: record.growthPercent,
            },
        });
    }

    toPersistence(
        entity: SalesPlanTemplate,
    ): Prisma.SalesPlanTemplateCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: entity.direction,
            department: { connect: { id: entity.department } },
            categoryId: categoryToPersistence(entity.category),
            turnover: entity.turnover,
            margin: entity.margin,
            growthPercent: entity.growthPercent,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
