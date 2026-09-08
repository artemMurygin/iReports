import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ServiceSaleEntity } from '@/domains/service/modules/reports/domain/entities/service-sale.entity';
import { ServiceCategory } from '@/domains/service/modules/reports/domain/value-objects/service-category.value-object';
import { OrderType } from '@/domains/service/modules/reports/domain/value-objects/order-type.value-object';
import {
    ServiceSalesFilter,
    ServiceSalesSourcePort,
} from '@/domains/service/modules/reports/application/ports/service-sales.port';

function inFilter<T extends string | number>(
    values: T[],
): { in: T[] } | undefined {
    return values.length > 0 ? { in: values } : undefined;
}

// Реализация ServiceSalesSourcePort — воспроизводит РОВНО те же два
// Prisma-запроса, что и легаси ReportsService.getServiceOrders/
// getServiceCategories (src/TODO/reports/reports.service.ts): тот же
// where/select/orderBy (в т.ч. отсутствие явного orderBy у
// findByFilter — легаси getServiceOrders тоже его не задаёт, порядок
// строк из БД важен для порядка ключей Map в GetServicesAnalyticsService,
// см. комментарий там).
@Injectable()
export class ServiceSalesRepository
    extends PrismaRepository
    implements ServiceSalesSourcePort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findByFilter(
        filter: ServiceSalesFilter,
    ): Promise<ServiceSaleEntity[]> {
        const rows = await this.client.roappServiceOrder.findMany({
            where: {
                order: {
                    closedAt: {
                        gte: filter.range.getFrom(),
                        lte: filter.range.getTo(),
                    },
                },
                serviceId: inFilter(filter.serviceIds),
                service: filter.categoryIds.length
                    ? { categoryId: inFilter(filter.categoryIds) }
                    : undefined,
            },
            select: {
                id: true,
                serviceId: true,
                orderId: true,
                quantity: true,
                price: true,
                engeneerSalary: true,
                service: {
                    select: { name: true, categoryId: true, price: true },
                },
                order: { select: { closedAt: true, payed: true, cost: true } },
            },
        });

        return rows.map(
            (row) =>
                new ServiceSaleEntity({
                    id: String(row.id),
                    props: {
                        serviceId: row.serviceId,
                        serviceName: row.service.name,
                        categoryId: row.service.categoryId,
                        retailPrice: row.service.price,
                        orderId: row.orderId,
                        quantity: row.quantity,
                        price: row.price,
                        engineerSalary: row.engeneerSalary,
                        // Заказ, попавший в выборку, отфильтрован по
                        // closedAt (see where выше) — так же, как в легаси,
                        // non-null assertion оправдан тем же условием.
                        closedAt: row.order.closedAt!,
                        orderPayed: row.order.payed ?? 0,
                        orderCost: row.order.cost ?? 0,
                    },
                }),
        );
    }

    async listCategories(): Promise<ServiceCategory[]> {
        const rows = await this.client.roappServiceCategory.findMany({
            select: { id: true, name: true, parentId: true, depth: true },
            orderBy: [{ depth: 'asc' }, { name: 'asc' }],
        });

        return rows.map((row) =>
            ServiceCategory.create({
                id: row.id,
                name: row.name,
                parentId: row.parentId,
                depth: row.depth,
            }),
        );
    }

    // Справочник типов заказов RoApp (roapp_order_types) — "категория заказа"
    // в терминах Фазы 1 (docs/service-plan-salary-rule-order-category-filter/
    // plan-service-plan-salary-rule-order-category-filter.md), для
    // GET /v1/service/reports/order-type. Плоская таблица без иерархии —
    // orderBy по имени, как listCategories выше сортирует внутри depth.
    async listOrderTypes(): Promise<OrderType[]> {
        const rows = await this.client.roappOrderType.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        return rows.map((row) =>
            OrderType.create({ id: row.id, name: row.name }),
        );
    }
}
