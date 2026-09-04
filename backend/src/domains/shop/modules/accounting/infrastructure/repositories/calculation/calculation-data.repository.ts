import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import type { EmployeeIdentityRef } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import type {
    PayPerHourHours,
    ShopProductSoldErpItem,
} from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';
import { WORKING_STATUS } from '@/modules/work-schedule/domain/constants/working-status';

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
            system: record.system,
            identifierType: record.identifierType,
            externalId: record.externalId,
        }));
    }

    // Часы сотрудника за период — сумма часов рабочих смен графика
    // (WorkScheduleEntry.status = WORKING), только дни с ролью из
    // PayPerHourShopEntity.ELIGIBLE_SCHEDULE_ROLES — зеркало
    // ServiceCalculationDataRepository.findHoursWorked (независимая
    // реализация, issue #57), общая с ним таблица WorkScheduleEntry без
    // дискриминатора direction (см. work-schedule.prisma). Возвращает пару
    // факт/прогноз: prognose — сумма часов всех подходящих дней периода,
    // fact — только тех, что не позже `now`. Conditional-агрегация по двум
    // диапазонам дат одним Prisma-запросом без raw SQL невозможна — читаем
    // строки и суммируем в коде, а не `aggregate`/`_sum`.
    async findHoursWorked(
        bitrixEmployeeId: number,
        period: string,
        now: Date = new Date(),
    ): Promise<PayPerHourHours> {
        const { from, to } = Period.create(period).getBounds();
        const factCutoff = now < to ? now : to;
        const entries = await this.client.workScheduleEntry.findMany({
            where: {
                employeeId: bitrixEmployeeId,
                status: WORKING_STATUS,
                role: { in: [...PayPerHourShopEntity.ELIGIBLE_SCHEDULE_ROLES] },
                date: { gte: from, lte: to },
            },
            select: { date: true, hours: true },
        });
        return entries.reduce<PayPerHourHours>(
            (acc, entry) => {
                const hours = entry.hours ?? 0;
                acc.prognose += hours;
                if (entry.date <= factCutoff) {
                    acc.fact += hours;
                }
                return acc;
            },
            { fact: 0, prognose: 0 },
        );
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
                assortmentName: true,
                quantity: true,
                sum: true,
                profit: true,
                onlinePurchaserId: true,
                offlinePurchaserId: true,
                product: { select: { folderId: true } },
                service: { select: { folderId: true } },
                demand: {
                    select: {
                        name: true,
                        onlineManagerId: true,
                        offlineManagerId: true,
                    },
                },
            },
        });

        return positions.map((position) => ({
            positionId: position.id,
            demandId: position.demandId,
            itemName: position.assortmentName,
            demandLabel: position.demand.name,
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
            // isServiceAccount: false (docs/employee-ordering-and-salary-filter,
            // Фаза 3) — зеркало ServiceCalculationDataRepository.findEmployeesInDepartment
            // (см. WHY там): единственный источник состава отдела и для
            // отчёта по зарплате отдела, и для расчёта закрытия периода по
            // схеме отдела.
            where: { departmentId, isServiceAccount: false },
            select: { id: true, firstName: true, lastName: true },
            // Единый порядок сотрудников (docs/employee-ordering-and-salary-filter,
            // Фаза 1) — тот же order, что и в DirectoryRepository.findEmployees,
            // а не прежний порядок БД по умолчанию (без orderBy): отчёт по
            // зарплате отдела (GetShopDepartmentSalaryReportService) строит
            // employees[] в точности в порядке этого списка.
            orderBy: { order: 'asc' },
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
                system: record.system,
                identifierType: record.identifierType,
                externalId: record.externalId,
            });
        }
        return map;
    }

    // Батч-версия findHoursWorked для отдела целиком — зеркало
    // ServiceCalculationDataRepository.findHoursWorkedForEmployees, та же
    // пара факт/прогноз и тот же фильтр по роли дня, что и у findHoursWorked
    // (см. комментарий там).
    async findHoursWorkedForEmployees(
        bitrixEmployeeIds: number[],
        period: string,
        now: Date = new Date(),
    ): Promise<Map<number, PayPerHourHours>> {
        const map = new Map<number, PayPerHourHours>();
        if (bitrixEmployeeIds.length === 0) {
            return map;
        }
        const { from, to } = Period.create(period).getBounds();
        const factCutoff = now < to ? now : to;
        const entries = await this.client.workScheduleEntry.findMany({
            where: {
                employeeId: { in: bitrixEmployeeIds },
                status: WORKING_STATUS,
                role: { in: [...PayPerHourShopEntity.ELIGIBLE_SCHEDULE_ROLES] },
                date: { gte: from, lte: to },
            },
            select: { employeeId: true, date: true, hours: true },
        });
        for (const entry of entries) {
            const hours = entry.hours ?? 0;
            const current = map.get(entry.employeeId) ?? {
                fact: 0,
                prognose: 0,
            };
            current.prognose += hours;
            if (entry.date <= factCutoff) {
                current.fact += hours;
            }
            map.set(entry.employeeId, current);
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
