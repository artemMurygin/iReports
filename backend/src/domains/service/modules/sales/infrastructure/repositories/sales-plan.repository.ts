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
                // updatedAt намеренно не передаётся: SalesPlan.edit()/.approve()
                // не бьют собственный updatedAt (у Entity нет сеттера для
                // него, см. shared/domain/entity.base.ts), поэтому
                // столбец с @updatedAt в sales.prisma обязан выставлять его
                // сам Prisma при записи — явная передача старого
                // props.updatedAt (как раньше) отключает это автообновление
                // и "замораживает" штамп на моменте создания строки. С Фазы
                // 6 это критично: max(updatedAt) строк плана периода — один
                // из трёх штампов свежести ленивого кэша расчёта зарплаты
                // (см. domain/services/accounting-cache-freshness.ts в
                // модуле accounting), правка/утверждение плана обязаны его
                // менять.
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
        category: string | null,
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
