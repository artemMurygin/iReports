import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import type {
    EmployeeIdentityRef,
    ExternalIdentifierType,
    ExternalSystem,
} from '@/shared/domain/calculation-context';
import type {
    ConfirmedTaskCompletionErpItem,
    OrderPayedErpItem,
    ServiceCompletedErpItem,
} from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { PAID_ORDER_STATUS_GROUPS } from '@/domains/service/modules/accounting/domain/services/paid-order-status';

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

    // "Оплаченный заказ" (Фаза 8) — заказ, чей ТЕКУЩИЙ статус относится к
    // "оплаченной" группе (см. paid-order-status.ts), и который закрыт в
    // периоде (RoappOrder.closedAt — тот же признак периода, что и у
    // findServiceCompletedItems/RoappSalesFactSourceRepository). Суммы —
    // исходные (payed/cost/engineerSalary), НЕ managerSalary (legacy-KPI).
    // engineerIds — объединение инженеров всех позиций заказа (услуг и
    // товаров), без дублей (см. order-payed.entity.ts).
    async findOrderPayedItems(
        from: Date,
        to: Date,
    ): Promise<OrderPayedErpItem[]> {
        const rows = await this.client.roappOrder.findMany({
            where: {
                closedAt: { gte: from, lte: to },
                status: { grupName: { in: [...PAID_ORDER_STATUS_GROUPS] } },
            },
            select: {
                id: true,
                payed: true,
                cost: true,
                engineerSalary: true,
                managerId: true,
                createdById: true,
                closedById: true,
                onlineManager: true,
                serviceOrders: { select: { engineerId: true } },
                productsOrders: { select: { engineerId: true } },
            },
        });

        return rows.map((row) => ({
            orderId: row.id,
            managerId: row.managerId,
            createdById: row.createdById,
            closedById: row.closedById,
            onlineManager: row.onlineManager,
            engineerIds: [
                ...new Set([
                    ...row.serviceOrders.map((item) => item.engineerId),
                    ...row.productsOrders.map((item) => item.engineerId),
                ]),
            ],
            revenue: row.payed ?? 0,
            cost: row.cost ?? 0,
            engineerSalary: row.engineerSalary ?? 0,
        }));
    }

    async findConfirmedTaskCompletions(
        period: string,
    ): Promise<ConfirmedTaskCompletionErpItem[]> {
        const records = await this.client.taskCompletion.findMany({
            where: { period, status: 'CONFIRMED' },
            select: { id: true, employeeId: true },
        });
        return records;
    }

    async findEmployeeDepartmentId(
        bitrixEmployeeId: number,
    ): Promise<number | null> {
        const record = await this.client.bitrixEmployee.findUnique({
            where: { id: bitrixEmployeeId },
            select: { departmentId: true },
        });
        return record?.departmentId ?? null;
    }

    async findEmployeesInDepartment(
        departmentId: number,
    ): Promise<{ id: number; name: string }[]> {
        const records = await this.client.bitrixEmployee.findMany({
            where: { departmentId },
            select: { id: true, firstName: true, lastName: true },
        });
        return records.map((record) => ({
            id: record.id,
            name: `${record.firstName} ${record.lastName}`,
        }));
    }

    async findEmployeeIdentitiesForEmployees(
        bitrixEmployeeIds: number[],
    ): Promise<Map<number, EmployeeIdentityRef[]>> {
        const map = new Map<number, EmployeeIdentityRef[]>(
            bitrixEmployeeIds.map((id) => [id, []]),
        );
        if (bitrixEmployeeIds.length === 0) {
            return map;
        }
        const records = await this.client.employeeIdentity.findMany({
            where: { bitrixEmployeeId: { in: bitrixEmployeeIds } },
        });
        for (const record of records) {
            map.get(record.bitrixEmployeeId)?.push({
                system: record.system as ExternalSystem,
                identifierType: record.identifierType as ExternalIdentifierType,
                externalId: record.externalId,
            });
        }
        return map;
    }

    async findHoursWorkedForEmployees(
        bitrixEmployeeIds: number[],
        period: string,
    ): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        if (bitrixEmployeeIds.length === 0) {
            return map;
        }
        const records = await this.client.employeeHoursEntry.findMany({
            where: { employeeId: { in: bitrixEmployeeIds }, period },
            select: { employeeId: true, hours: true },
        });
        for (const record of records) {
            map.set(record.employeeId, record.hours);
        }
        return map;
    }
}
