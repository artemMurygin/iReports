import {
    SalesPlanTemplate as SalesPlanTemplateRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopSalesPlanTemplate } from '@/domains/shop/modules/sales/domain/entities/sales-plan-template.entity';
import { ShopSalesPlanScope } from '@/domains/shop/modules/sales/domain/value-objects/sales-plan-scope.value-object';
import { categoryToDomain, categoryToPersistence } from './sales-plan.mapper';

// Зеркало domains/service/modules/sales/infrastructure/mappers/
// sales-plan-template.mapper.ts (Фаза 7).
export class ShopSalesPlanTemplateMapper implements Mapper<
    ShopSalesPlanTemplate,
    Prisma.SalesPlanTemplateCreateInput
> {
    toDomain(record: SalesPlanTemplateRecord): ShopSalesPlanTemplate {
        return new ShopSalesPlanTemplate({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                scope: ShopSalesPlanScope.create(
                    record.departmentId,
                    categoryToDomain(record.categoryId),
                ),
                turnover: record.turnover,
                margin: record.margin,
                orderTypeIds: record.orderTypeIds,
                growthPercent: record.growthPercent,
                sortOrder: record.sortOrder,
            },
        });
    }

    toPersistence(
        entity: ShopSalesPlanTemplate,
    ): Prisma.SalesPlanTemplateCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: 'shop',
            department: { connect: { id: entity.department } },
            categoryId: categoryToPersistence(entity.category),
            turnover: entity.turnover,
            margin: entity.margin,
            orderTypeIds: entity.orderTypeIds,
            growthPercent: entity.growthPercent,
            sortOrder: entity.sortOrder,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
