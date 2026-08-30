import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopSalesPlanTemplate } from '@/domains/shop/modules/sales/domain/entities/sales-plan-template.entity';
import { ShopSalesPlanTemplateRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan-template.port';
import { ShopSalesPlanTemplateMapper } from '../mappers/sales-plan-template.mapper';
import { categoryToPersistence } from '../mappers/sales-plan.mapper';

// Зеркало domains/service/modules/sales/infrastructure/repositories/
// sales-plan-template.repository.ts (Фаза 7) — независимая копия для
// направления shop: та же общая Prisma-таблица sales_plan_templates, тот
// же Prisma-делегат salesPlanTemplate, но всегда с фиксированным
// direction: 'shop'.
@Injectable()
export class ShopSalesPlanTemplateRepository
    extends PrismaRepository
    implements ShopSalesPlanTemplateRepositoryPort
{
    private readonly mapper = new ShopSalesPlanTemplateMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: ShopSalesPlanTemplate): Promise<void> {
        await this.write(entity, (client) =>
            client.salesPlanTemplate.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: ShopSalesPlanTemplate): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.salesPlanTemplate.update({
                where: { id: props.id },
                data: {
                    turnover: entity.turnover,
                    margin: entity.margin,
                    orderTypeIds: entity.orderTypeIds,
                    growthPercent: entity.growthPercent,
                    updatedAt: props.updatedAt,
                },
            }),
        );
    }

    async findByScope(
        department: number,
        category: string | null,
    ): Promise<ShopSalesPlanTemplate | null> {
        const record = await this.client.salesPlanTemplate.findUnique({
            where: {
                direction_departmentId_categoryId: {
                    direction: 'shop',
                    departmentId: department,
                    categoryId: categoryToPersistence(category),
                },
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findAll(): Promise<ShopSalesPlanTemplate[]> {
        const records = await this.client.salesPlanTemplate.findMany({
            where: { direction: 'shop' },
            orderBy: [{ departmentId: 'asc' }, { categoryId: 'asc' }],
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
