import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalesPlanTemplate } from '@/domains/service/modules/sales/domain/entities/sales-plan-template.entity';
import { SalesPlanTemplateRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import type { SalesDirection } from '@/domains/service/modules/sales/domain/types/sales-plan.types';
import { SalesPlanTemplateMapper } from '../mappers/sales-plan-template.mapper';
import { categoryToPersistence } from '../mappers/sales-plan.mapper';

@Injectable()
export class SalesPlanTemplateRepository
    extends PrismaRepository
    implements SalesPlanTemplateRepositoryPort
{
    private readonly mapper = new SalesPlanTemplateMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: SalesPlanTemplate): Promise<void> {
        await this.write(entity, (client) =>
            client.salesPlanTemplate.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: SalesPlanTemplate): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.salesPlanTemplate.update({
                where: { id: props.id },
                data: {
                    turnover: entity.turnover,
                    margin: entity.margin,
                    growthPercent: entity.growthPercent,
                    updatedAt: props.updatedAt,
                },
            }),
        );
    }

    async findByScope(
        direction: SalesDirection,
        department: number,
        category: number | null,
    ): Promise<SalesPlanTemplate | null> {
        const record = await this.client.salesPlanTemplate.findUnique({
            where: {
                direction_departmentId_categoryId: {
                    direction,
                    departmentId: department,
                    categoryId: categoryToPersistence(category),
                },
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findAll(direction?: SalesDirection): Promise<SalesPlanTemplate[]> {
        const records = await this.client.salesPlanTemplate.findMany({
            where: direction ? { direction } : undefined,
            orderBy: [{ departmentId: 'asc' }, { categoryId: 'asc' }],
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
