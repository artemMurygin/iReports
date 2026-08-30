import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopSalesPlan } from '@/domains/shop/modules/sales/domain/entities/sales-plan.entity';
import { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import {
    ShopSalesPlanMapper,
    categoryToPersistence,
} from '../mappers/sales-plan.mapper';

// Зеркало domains/service/modules/sales/infrastructure/repositories/
// sales-plan.repository.ts (Фаза 7 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop: та же общая Prisma-таблица
// sales_plans, тот же Prisma-делегат salesPlan, но всегда с фиксированным
// direction: 'shop'.
@Injectable()
export class ShopSalesPlanRepository
    extends PrismaRepository
    implements ShopSalesPlanRepositoryPort
{
    private readonly mapper = new ShopSalesPlanMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: ShopSalesPlan): Promise<void> {
        await this.write(entity, (client) =>
            client.salesPlan.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: ShopSalesPlan): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.salesPlan.update({
                where: { id: props.id },
                // updatedAt намеренно не передаётся — см. WHY в сервисном
                // зеркале (SalesPlanRepository.update): Prisma сама
                // выставляет @updatedAt при записи, это критично для
                // третьего штампа свежести ленивого кэша расчёта зарплаты
                // shop (accounting-cache-freshness.ts).
                data: {
                    turnover: entity.turnover,
                    margin: entity.margin,
                    orderTypeIds: entity.orderTypeIds,
                    source: entity.source,
                    status: entity.status,
                    approvedBy: entity.approvedBy,
                    approvedAt: entity.approvedAt,
                },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.salesPlan.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<ShopSalesPlan | null> {
        const record = await this.client.salesPlan.findFirst({
            where: { id, direction: 'shop' },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByIds(ids: string[]): Promise<ShopSalesPlan[]> {
        if (ids.length === 0) {
            return [];
        }
        const records = await this.client.salesPlan.findMany({
            where: { id: { in: ids }, direction: 'shop' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByScope(
        department: number,
        category: string | null,
        period: string,
    ): Promise<ShopSalesPlan | null> {
        const record = await this.client.salesPlan.findUnique({
            where: {
                direction_departmentId_categoryId_period: {
                    direction: 'shop',
                    departmentId: department,
                    categoryId: categoryToPersistence(category),
                    period,
                },
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByPeriod(period: string): Promise<ShopSalesPlan[]> {
        const records = await this.client.salesPlan.findMany({
            where: { direction: 'shop', period },
            orderBy: [{ departmentId: 'asc' }, { categoryId: 'asc' }],
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
