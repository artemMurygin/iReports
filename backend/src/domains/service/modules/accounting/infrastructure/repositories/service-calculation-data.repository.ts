import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import type {
    EmployeeIdentityRef,
    ExternalIdentifierType,
    ExternalSystem,
} from '@/shared/domain/calculation-context';
import type { ServiceCompletedErpItem } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';

@Injectable()
export class ServiceCalculationDataRepository
    extends PrismaRepository
    implements ServiceCalculationDataPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findEmployeeIdentities(
        bitrixEmployeeId: number,
    ): Promise<EmployeeIdentityRef[]> {
        const records = await this.client.employeeIdentity.findMany({
            where: { bitrixEmployeeId },
        });
        return records.map((record) => ({
            system: record.system as ExternalSystem,
            identifierType: record.identifierType as ExternalIdentifierType,
            externalId: record.externalId,
        }));
    }

    // "Выполненная услуга" — позиция заказа, чей заказ закрыт в периоде
    // (RoappOrder.closedAt, тот же признак "оплаченного и закрытого"
    // заказа, что и у RoappSalesFactSourceRepository, см. Фазу 5). Один
    // запрос на весь период, без фильтра по сотруднику — набор общий для
    // всех правил схемы, каждое фильтрует свою выборку по роли само (см.
    // service-role-source.ts).
    async findServiceCompletedItems(
        from: Date,
        to: Date,
    ): Promise<ServiceCompletedErpItem[]> {
        const rows = await this.client.roappServiceOrder.findMany({
            where: {
                order: { closedAt: { gte: from, lte: to } },
            },
            select: {
                id: true,
                orderId: true,
                serviceId: true,
                quantity: true,
                price: true,
                engineerId: true,
                service: { select: { engeneerBonus: true } },
                order: {
                    select: {
                        managerId: true,
                        createdById: true,
                        closedById: true,
                        onlineManager: true,
                    },
                },
            },
        });

        return rows.map((row) => ({
            serviceOrderId: row.id,
            orderId: row.orderId,
            serviceId: row.serviceId,
            quantity: row.quantity,
            linePrice: row.price,
            catalogEngineerBonus: row.service.engeneerBonus,
            engineerId: row.engineerId,
            managerId: row.order.managerId,
            createdById: row.order.createdById,
            closedById: row.order.closedById,
            onlineManager: row.order.onlineManager,
        }));
    }

    async findHoursWorked(
        bitrixEmployeeId: number,
        period: string,
    ): Promise<number> {
        const record = await this.client.employeeHoursEntry.findUnique({
            where: {
                employeeId_period: { employeeId: bitrixEmployeeId, period },
            },
        });
        return record?.hours ?? 0;
    }
}
