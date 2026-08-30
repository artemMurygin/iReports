import {
    SalesPlan as SalesPlanRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopSalesPlan } from '@/domains/shop/modules/sales/domain/entities/sales-plan.entity';
import { ShopSalesPlanScope } from '@/domains/shop/modules/sales/domain/value-objects/sales-plan-scope.value-object';
import { ShopSalesPlanApproval } from '@/domains/shop/modules/sales/domain/value-objects/sales-plan-approval.value-object';

// Зеркало domains/service/modules/sales/infrastructure/mappers/
// sales-plan.mapper.ts (Фаза 7 docs/service-shop-boundary-violations-fix) —
// независимая копия для направления shop. "Без категории" хранится в БД тем
// же сентинелом NO_CATEGORY_ID = '' (см. WHY в сервисном мапере) — тот же
// составной уникальный индекс (direction, department_id, category_id[,
// period]) на общей таблице sales_plans/sales_plan_templates. Направление
// (record.direction) не читается в toDomain намеренно — то же решение, что
// и у ShopTaskCompletionMapper: строки этого направления и так
// отфильтрованы ShopSalesPlanRepository (`where: { direction: 'shop' }`),
// а доменная сущность ShopSalesPlan направления не хранит вовсе.
export const NO_CATEGORY_ID = '';

export function categoryToDomain(categoryId: string): string | null {
    return categoryId === NO_CATEGORY_ID ? null : categoryId;
}

export function categoryToPersistence(category: string | null): string {
    return category ?? NO_CATEGORY_ID;
}

export class ShopSalesPlanMapper implements Mapper<
    ShopSalesPlan,
    Prisma.SalesPlanCreateInput
> {
    toDomain(record: SalesPlanRecord): ShopSalesPlan {
        return new ShopSalesPlan({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                scope: ShopSalesPlanScope.create(
                    record.departmentId,
                    categoryToDomain(record.categoryId),
                ),
                period: record.period,
                turnover: record.turnover,
                margin: record.margin,
                orderTypeIds: record.orderTypeIds,
                source: record.source,
                status: record.status,
                approval:
                    record.approvedBy !== null && record.approvedAt !== null
                        ? ShopSalesPlanApproval.create(
                              record.approvedBy,
                              record.approvedAt,
                          )
                        : null,
            },
        });
    }

    toPersistence(entity: ShopSalesPlan): Prisma.SalesPlanCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            // Направление записи (Фаза 7) — фиксированное 'shop' для этого
            // маппера: домен shop никогда не пишет чужие записи.
            direction: 'shop',
            department: { connect: { id: entity.department } },
            categoryId: categoryToPersistence(entity.category),
            period: entity.period,
            turnover: entity.turnover,
            margin: entity.margin,
            orderTypeIds: entity.orderTypeIds,
            source: entity.source,
            status: entity.status,
            approvedBy: entity.approvedBy,
            approvedAt: entity.approvedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
