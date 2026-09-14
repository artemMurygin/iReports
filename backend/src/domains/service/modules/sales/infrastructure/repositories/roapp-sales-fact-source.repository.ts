import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Period } from '@/shared/domain/period.value-object';
import {
    ServiceSalesFactErpAggregate,
    ServiceSalesFactSourcePort,
} from '@/domains/service/modules/sales/application/ports/service-sales-fact-source.port';

// Решение по открытому вопросу Фазы 5, не описанному явно ни в PRD, ни в
// плане (RoappOrder не хранит отдел — SalesPlan.department ссылается на
// BitrixDepartment, а не на что-либо в RoApp/RemOnline):
//
// - **Отдел заказа** определяется через сотрудника, закрывшего заказ
//   (RoappOrder.closedById → EmployeeIdentity(system=ROAPP,
//   identifierType=EMPLOYEE_ID, externalId=closedById) → BitrixEmployee →
//   departmentId). Читаем таблицу employeeIdentity напрямую через Prisma,
//   как ServiceCalculationDataRepository.findEmployeeIdentities (см.
//   domains/service/modules/accounting/infrastructure/repositories/
//   calculation/service-calculation-data.repository.ts) — EmployeeIdentityModule
//   не экспортирует репозиторий/DI-токен наружу. Историческое уникальное
//   поле BitrixEmployee.roappId (использовалось здесь раньше) ничем в
//   текущем коде не заполняется — на любой БД, где сотрудники синканы уже
//   после миграции Фазы 2, оно пустое, и отдел никогда не резолвился, из-за
//   чего факт был всегда нулевым. Заказ, чей закрывший сотрудник не
//   сопоставлен ни с каким Bitrix-отделом, не входит ни в один SalesFact
//   (а не попадает в "виртуальный" безымянный отдел).
// - **"Оплаченный и закрытый" заказ** — заказ с непустым `payed` и
//   `closedAt` внутри периода. Полное определение "оплаченного заказа"
//   для правила OrderPayed — предмет отдельного открытого вопроса Фазы 8
//   (статус vs факт полной оплаты); для агрегата SalesFact этой фазы
//   достаточно достоверного признака, что деньги по заказу уже поступили.
// - **Категория** для сервиса в этой фазе не определена на уровне
//   ERP-данных (RoappOrder не хранит категорию заказа) — факт всегда
//   агрегируется только по отделу (и, с
//   docs/service-plan-salary-rule-order-category-filter, типу заказа),
//   category = null. Строки плана с непустой категорией получают нулевой
//   факт до появления источника категорий для сервиса (вне скоупа Фазы 5).
// - **Тип заказа** — RoappOrder.orderTypeId, обязательное поле (см.
//   roapp.prisma), поэтому у каждого заказа есть ровно один тип; бакеты
//   агрегируются по паре (department, orderTypeId), а не только по отделу
//   — так GetSalesPerformanceService может просуммировать по строке плана
//   только бакеты нужных ей типов заказов (SalesPlan.orderTypeIds), не
//   трогая семантику department/category выше.
//
// Один запрос на заказы периода + один батч-запрос identities + один
// батч-запрос сотрудников (без N+1 по строкам плана), JS-агрегация по
// (отделу, типу заказа) — набор заказов за месяц не настолько велик, чтобы
// это было проблемой производительности; GROUP BY по полю через связку
// employeeIdentity → bitrixEmployee в чистом Prisma без raw SQL не выразить.
@Injectable()
export class RoappSalesFactSourceRepository
    extends PrismaRepository
    implements ServiceSalesFactSourcePort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async aggregate(period: string): Promise<ServiceSalesFactErpAggregate[]> {
        const { from, to } = Period.create(period).getBounds();

        console.log(
            '[SALES_FACT_DEBUG] RoappSalesFactSourceRepository.aggregate: период',
            {
                period,
                from,
                to,
            },
        );

        const orders = await this.client.roappOrder.findMany({
            where: {
                closedAt: { gte: from, lte: to },
                payed: { not: null },
                closedById: { not: null },
            },
            select: {
                payed: true,
                cost: true,
                orderTypeId: true,
                closedById: true,
            },
        });

        console.log(
            '[SALES_FACT_DEBUG] RoappSalesFactSourceRepository.aggregate: найдено заказов (closedAt в периоде, payed IS NOT NULL)',
            orders.length,
        );

        const closedByIds = [
            ...new Set(
                orders
                    .map((order) => order.closedById)
                    .filter((id): id is number => id != null),
            ),
        ];
        const identities = await this.client.employeeIdentity.findMany({
            where: {
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: { in: closedByIds.map(String) },
            },
            select: { externalId: true, bitrixEmployeeId: true },
        });
        const bitrixEmployeeIdByRoappId = new Map(
            identities.map((identity) => [
                identity.externalId,
                identity.bitrixEmployeeId,
            ]),
        );
        const bitrixEmployees = await this.client.bitrixEmployee.findMany({
            where: {
                id: { in: [...new Set(bitrixEmployeeIdByRoappId.values())] },
            },
            select: { id: true, departmentId: true },
        });
        const departmentByBitrixEmployeeId = new Map(
            bitrixEmployees.map((employee) => [
                employee.id,
                employee.departmentId,
            ]),
        );

        // Ключ бакета — (departmentId, orderTypeId): один заказ всегда
        // попадает ровно в один бакет, GetSalesPerformanceService потом
        // суммирует нужные бакеты одного отдела по SalesPlan.orderTypeIds.
        const byDepartmentAndOrderType = new Map<
            string,
            {
                department: number;
                orderTypeId: number;
                turnover: number;
                cost: number;
                quantity: number;
            }
        >();
        let skippedWithoutDepartment = 0;
        for (const order of orders) {
            const bitrixEmployeeId = bitrixEmployeeIdByRoappId.get(
                String(order.closedById),
            );
            const departmentId =
                bitrixEmployeeId != null
                    ? departmentByBitrixEmployeeId.get(bitrixEmployeeId)
                    : undefined;
            if (!departmentId) {
                skippedWithoutDepartment += 1;
                continue;
            }
            const key = `${departmentId}:${order.orderTypeId}`;
            const bucket = byDepartmentAndOrderType.get(key) ?? {
                department: departmentId,
                orderTypeId: order.orderTypeId,
                turnover: 0,
                cost: 0,
                quantity: 0,
            };
            bucket.turnover += order.payed ?? 0;
            bucket.cost += order.cost ?? 0;
            bucket.quantity += 1;
            byDepartmentAndOrderType.set(key, bucket);
        }

        const result = [...byDepartmentAndOrderType.values()].map((agg) => ({
            category: null,
            ...agg,
        }));

        console.log(
            '[SALES_FACT_DEBUG] RoappSalesFactSourceRepository.aggregate: результат',
            {
                skippedWithoutDepartment,
                buckets: result,
            },
        );

        return result;
    }
}
