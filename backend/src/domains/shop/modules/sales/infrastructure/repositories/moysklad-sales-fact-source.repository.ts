import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Period } from '@/shared/domain/period.value-object';
import {
    ShopSalesFactErpAggregate,
    ShopSalesFactSourcePort,
} from '@/domains/shop/modules/sales/application/ports/shop-sales-fact-source.port';

// Решение по открытому вопросу Фазы 11 (зеркало решения Фазы 5 для
// service, см. domains/service/modules/sales/infrastructure/repositories/
// roapp-sales-fact-source.repository.ts):
//
// - **Период** фильтруется по MoySkladDemand.moment (дата операции в
//   МойСклад, индексирована — см. moySklad.prisma), а не createdAt —
//   moment это дата, к которой относится сама отгрузка (в отличие от
//   RoappOrder, где "оплаченный и закрытый заказ" определялся полями
//   payed/closedAt, у MoySkladDemand отдельного признака "оплаты" на
//   уровне факта не используется: отгрузка — уже свершившаяся реализация
//   товара, а не заказ в процессе выполнения, поэтому дополнительный
//   фильтр по payedSum не нужен).
// - **Отдел отгрузки** определяется через offlineManagerId — это поле,
//   которым мы мапим стандартное МойСклад-поле "ответственный" (owner),
//   присутствует всегда, в отличие от onlineManagerId, который заполнен
//   только для части отгрузок (кастомный атрибут, см.
//   backend/src/domains/shop/CLAUDE.md и moysklad-sync.mappers.ts):
//   MoySkladDemand.offlineManagerId → MoySkladEmployee.bitrixEmployee →
//   BitrixEmployee.departmentId. Как и у service, используется прямая
//   Prisma-связь через историческое поле BitrixEmployee.moySkladId, а не
//   батч-резолвер через EmployeeIdentity — тот же выбор, что и в Фазе 5,
//   по тем же причинам (полноценный маппинг "роль правила → поле ERP" для
//   магазина — предмет будущей фазы, не этой). Позиция, чья отгрузка не
//   сопоставлена ни с каким Bitrix-отделом, не входит ни в один
//   ShopSalesFact.
// - **Маржа** — сумма MoySkladDemandPosition.profit по позициям, НЕ
//   turnover - cost (см. ShopSalesFactCalculateInput.margin).
// - **Категория** — всегда null, см. ShopSalesFactErpAggregate.category.
//
// Один запрос на весь период (без N+1 по строкам плана), JS-агрегация по
// отделу — тот же приём и то же обоснование производительности, что и у
// RoappSalesFactSourceRepository.
@Injectable()
export class MoySkladSalesFactSourceRepository
    extends PrismaRepository
    implements ShopSalesFactSourcePort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async aggregate(period: string): Promise<ShopSalesFactErpAggregate[]> {
        const { from, to } = Period.create(period).getBounds();

        const positions = await this.client.moySkladDemandPosition.findMany({
            where: {
                demand: {
                    moment: { gte: from, lte: to },
                },
            },
            select: {
                sum: true,
                cost: true,
                profit: true,
                quantity: true,
                demand: {
                    select: {
                        offlineManager: {
                            select: {
                                bitrixEmployee: {
                                    select: { departmentId: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        const byDepartment = new Map<
            number,
            { turnover: number; margin: number; cost: number; quantity: number }
        >();
        for (const position of positions) {
            const departmentId =
                position.demand.offlineManager?.bitrixEmployee?.departmentId;
            if (!departmentId) {
                continue;
            }
            const bucket = byDepartment.get(departmentId) ?? {
                turnover: 0,
                margin: 0,
                cost: 0,
                quantity: 0,
            };
            bucket.turnover += position.sum;
            bucket.margin += position.profit;
            bucket.cost += position.cost;
            bucket.quantity += position.quantity;
            byDepartment.set(departmentId, bucket);
        }

        return [...byDepartment.entries()].map(([department, agg]) => ({
            department,
            category: null,
            ...agg,
        }));
    }
}
