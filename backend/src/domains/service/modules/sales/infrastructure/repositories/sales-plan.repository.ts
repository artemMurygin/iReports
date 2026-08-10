import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesDirection } from '@/domains/service/modules/sales/domain/types/sales-plan.types';
import {
    SalesPlanMapper,
    categoryToPersistence,
} from '../mappers/sales-plan.mapper';

@Injectable()
export class SalesPlanRepository
    extends PrismaRepository
    implements SalesPlanRepositoryPort
{
    private readonly mapper = new SalesPlanMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: SalesPlan): Promise<void> {
        await this.write(entity, (client) =>
            client.salesPlan.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: SalesPlan): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.salesPlan.update({
                where: { id: props.id },
                data: {
                    turnover: entity.turnover,
                    margin: entity.margin,
                    source: entity.source,
                    status: entity.status,
                    approvedBy: entity.approvedBy,
                    approvedAt: entity.approvedAt,
                    updatedAt: props.updatedAt,
                },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.salesPlan.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<SalesPlan | null> {
        const record = await this.client.salesPlan.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByIds(ids: string[]): Promise<SalesPlan[]> {
        if (ids.length === 0) {
            return [];
        }
        const records = await this.client.salesPlan.findMany({
            where: { id: { in: ids } },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByScope(
        direction: SalesDirection,
        department: number,
        category: number | null,
        period: string,
    ): Promise<SalesPlan | null> {
        const record = await this.client.salesPlan.findUnique({
            where: {
                direction_departmentId_categoryId_period: {
                    direction,
                    departmentId: department,
                    categoryId: categoryToPersistence(category),
                    period,
                },
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByDirectionAndPeriod(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPlan[]> {
        const records = await this.client.salesPlan.findMany({
            where: { direction, period },
            orderBy: [{ departmentId: 'asc' }, { categoryId: 'asc' }],
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
