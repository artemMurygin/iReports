import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import type {
    EmployeeIdentityRef,
    ExternalIdentifierType,
    ExternalSystem,
} from '@/shared/domain/calculation-context';
import type {
    ShopProductSoldErpItem,
    ShopTaskCompletionErpItem,
} from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';
import { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';

// Реализация ShopCalculationDataPort (Фаза 13.5) — независимая от
// ServiceCalculationDataRepository (issue #57), но зеркальная по структуре.
@Injectable()
export class ShopCalculationDataRepository
    extends PrismaRepository
    implements ShopCalculationDataPort
{
    constructor(
        db: DatabaseService,
        private readonly folderTree: ProductFolderTreeService,
    ) {
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

    // Позиции отгрузок периода (MoySkladDemand.moment — тот же признак
    // периода, что и у MoySkladSalesFactSourceRepository, Фаза 11) — период-
    // широкий набор, без фильтра по сотруднику (см. порт). folderId — из
    // товара либо услуги позиции (у позиции заполнено ровно одно из двух).
    async findProductSoldItems(
        from: Date,
        to: Date,
    ): Promise<ShopProductSoldErpItem[]> {
        const positions = await this.client.moySkladDemandPosition.findMany({
            where: { demand: { moment: { gte: from, lte: to } } },
            select: {
                id: true,
                demandId: true,
                quantity: true,
                sum: true,
                profit: true,
                onlinePurchaserId: true,
                offlinePurchaserId: true,
                product: { select: { folderId: true } },
                service: { select: { folderId: true } },
                demand: {
                    select: { onlineManagerId: true, offlineManagerId: true },
                },
            },
        });

        return positions.map((position) => ({
            positionId: position.id,
            demandId: position.demandId,
            folderId:
                position.product?.folderId ??
                position.service?.folderId ??
                null,
            quantity: position.quantity,
            sum: position.sum,
            profit: position.profit,
            onlineManagerId: position.demand.onlineManagerId,
            offlineManagerId: position.demand.offlineManagerId,
            onlinePurchaserId: position.onlinePurchaserId,
            offlinePurchaserId: position.offlinePurchaserId,
        }));
    }

    async findConfirmedTaskCompletions(
        period: string,
    ): Promise<ShopTaskCompletionErpItem[]> {
        // direction: 'shop' — зеркало TaskCompletionRepository сервиса
        // (фильтрует 'service'); без него сюда попали бы и записи
        // сервисного CQRS-модуля (см. TaskCompletion.direction в
        // prisma/schema/salary.prisma).
        const records = await this.client.taskCompletion.findMany({
            where: { period, status: 'CONFIRMED', direction: 'shop' },
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

    async resolveCategoryDescendantFolderIds(
        rootFolderIds: string[],
    ): Promise<Record<string, string[]>> {
        const unique = [...new Set(rootFolderIds)];
        const entries = await Promise.all(
            unique.map(
                async (id) =>
                    [
                        id,
                        await this.folderTree.resolveDescendantFolderIds(id),
                    ] as const,
            ),
        );
        return Object.fromEntries(entries);
    }
}
