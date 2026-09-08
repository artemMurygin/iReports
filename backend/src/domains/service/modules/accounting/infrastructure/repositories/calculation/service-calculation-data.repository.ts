import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import type { EmployeeIdentityRef } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import type {
    OrderPayedErpItem,
    PayPerHourHours,
    ServiceCompletedErpItem,
} from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import { PAID_ORDER_STATUS_GROUPS } from '@/domains/service/modules/accounting/domain/services/paid-order-status';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { WORKING_STATUS } from '@/modules/work-schedule/domain/constants/working-status';

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
            system: record.system,
            identifierType: record.identifierType,
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
                service: { select: { engeneerBonus: true, name: true } },
                order: {
                    select: {
                        managerId: true,
                        onlineManager: true,
                        label: true,
                        deviceBrand: true,
                        deviceModel: true,
                        deviceColor: true,
                        malfunction: true,
                        orderTypeId: true,
                    },
                },
            },
        });

        return rows.map((row) => ({
            serviceOrderId: row.id,
            orderId: row.orderId,
            orderLabel: row.order.label,
            brand: row.order.deviceBrand,
            deviceModel: row.order.deviceModel,
            deviceColor: row.order.deviceColor,
            malfunction: row.order.malfunction,
            serviceId: row.serviceId,
            quantity: row.quantity,
            linePrice: row.price,
            catalogEngineerBonus: row.service.engeneerBonus,
            serviceName: row.service.name,
            engineerId: row.engineerId,
            managerId: row.order.managerId,
            onlineManager: row.order.onlineManager,
            orderTypeId: row.order.orderTypeId,
        }));
    }

    // Часы сотрудника за период — сумма часов рабочих смен графика
    // (WorkScheduleEntry.status = WORKING), только дни с ролью
    // ONLINE_MANAGER/OFFLINE_MANAGER/SOLO_MANAGER (см.
    // PayPerHoursEntity.ELIGIBLE_SCHEDULE_ROLES) —
    // почасовая оплата не начисляется за дни другой роли (в т.ч.
    // ENGINEER/OFFICE — инженеры офиса). Граница периода — тот же
    // Period.getBounds(), что и у остальных ERP-выборок этого репозитория;
    // WorkScheduleEntry.date хранится тем же UTC-принципом (см.
    // ScheduleDate), поэтому day-колонка @db.Date корректно попадает в
    // диапазон gte/lte. Возвращает пару факт/прогноз (Фаза "Pay Per Hour:
    // график"): prognose — сумма часов всех подходящих дней периода
    // (весь месяц по графику), fact — только тех, что не позже `now`
    // ("по сегодняшний день включительно"), с учётом отсечки по концу
    // периода. Conditional-агрегация по двум диапазонам дат одним
    // Prisma-запросом без raw SQL невозможна — читаем строки и суммируем
    // в коде, а не `aggregate`/`_sum`.
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
                role: { in: [...PayPerHoursEntity.ELIGIBLE_SCHEDULE_ROLES] },
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
                label: true,
                payed: true,
                cost: true,
                engineerSalary: true,
                managerId: true,
                onlineManager: true,
                deviceBrand: true,
                deviceModel: true,
                deviceColor: true,
                malfunction: true,
                orderTypeId: true,
                serviceOrders: { select: { engineerId: true } },
                productsOrders: { select: { engineerId: true } },
            },
        });

        return rows.map((row) => ({
            orderId: row.id,
            label: row.label,
            brand: row.deviceBrand,
            deviceModel: row.deviceModel,
            deviceColor: row.deviceColor,
            malfunction: row.malfunction,
            managerId: row.managerId,
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
            orderTypeId: row.orderTypeId,
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
            // Фаза 3) — единственный источник состава отдела и для отчёта по
            // зарплате отдела (GetDepartmentSalaryReportService), и для
            // расчёта закрытия периода по схеме отдела
            // (ResolveEmployeeSalaryRulesService.forAllTargets), поэтому
            // служебные аккаунты отсеиваются здесь же, одним местом — они не
            // должны попасть ни в список, ни в расчёт, ни в снапшот/
            // начисление закрытия периода.
            where: { departmentId, isServiceAccount: false },
            select: { id: true, firstName: true, lastName: true },
            // Единый порядок сотрудников (docs/employee-ordering-and-salary-filter,
            // Фаза 1) — тот же order, что и в DirectoryRepository.findEmployees,
            // а не прежний порядок БД по умолчанию (без orderBy): отчёт по
            // зарплате отдела (GetDepartmentSalaryReportService) строит
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

    // Батч-версия findHoursWorked для отдела целиком (Фаза 9) — один запрос
    // вместо одного на сотрудника (тот же приём "один запрос на отдел", что
    // и у остальных find*ForEmployees), та же пара факт/прогноз и тот же
    // фильтр по роли дня, что и у findHoursWorked — см. комментарий там.
    // Сотрудник без единой подходящей рабочей смены за период в выборку не
    // попадает — карта просто не содержит его ключ, вызывающая сторона уже
    // трактует отсутствие как { fact: 0, prognose: 0 }.
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
                role: { in: [...PayPerHoursEntity.ELIGIBLE_SCHEDULE_ROLES] },
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
}
