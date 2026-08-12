import {
    SalesPlan as SalesPlanRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { SalesPlanScope } from '@/domains/service/modules/sales/domain/value-objects/sales-plan-scope.value-object';
import { SalesPlanApproval } from '@/domains/service/modules/sales/domain/value-objects/sales-plan-approval.value-object';
import type {
    SalesDirection,
    SalesPlanSource,
    SalesPlanStatus,
} from '@/domains/service/modules/sales/domain/types/sales-plan.types';

// "Без категории" хранится в БД сентинелом NO_CATEGORY_ID (''), а не NULL:
// Postgres не считает два NULL равными в составном уникальном индексе
// (direction, department_id, category_id[, period], см. sales.prisma),
// поэтому обычный nullable-столбец не защитил бы от дубля "план без
// категории на тот же месяц". Пустая строка безопасна как сентинел, потому
// что домен и так запрещает её как настоящее значение категории (см.
// SalesPlanScope.create) — реальная категория никогда не придёт как ''.
// Наружу этого модуля сентинел никогда не протекает — домен и контракты
// работают только с category: string | null (для shop это UUID папки
// МойСклад, см. domains/shop/CLAUDE.md).
export const NO_CATEGORY_ID = '';

export function categoryToDomain(categoryId: string): string | null {
    return categoryId === NO_CATEGORY_ID ? null : categoryId;
}

export function categoryToPersistence(category: string | null): string {
    return category ?? NO_CATEGORY_ID;
}

export class SalesPlanMapper implements Mapper<
    SalesPlan,
    Prisma.SalesPlanCreateInput
> {
    toDomain(record: SalesPlanRecord): SalesPlan {
        return new SalesPlan({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                scope: SalesPlanScope.create(
                    record.direction as SalesDirection,
                    record.departmentId,
                    categoryToDomain(record.categoryId),
                ),
                period: record.period,
                turnover: record.turnover,
                margin: record.margin,
                source: record.source as SalesPlanSource,
                status: record.status as SalesPlanStatus,
                approval:
                    record.approvedBy !== null && record.approvedAt !== null
                        ? SalesPlanApproval.create(
                              record.approvedBy,
                              record.approvedAt,
                          )
                        : null,
            },
        });
    }

    toPersistence(entity: SalesPlan): Prisma.SalesPlanCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: entity.direction,
            department: { connect: { id: entity.department } },
            categoryId: categoryToPersistence(entity.category),
            period: entity.period,
            turnover: entity.turnover,
            margin: entity.margin,
            source: entity.source,
            status: entity.status,
            approvedBy: entity.approvedBy,
            approvedAt: entity.approvedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
