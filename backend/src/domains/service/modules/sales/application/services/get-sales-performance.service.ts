import { Inject, Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { EnsureSalesPlansForPeriodService } from './ensure-sales-plans-for-period.service';
import { SERVICE_SALES_FACT_SOURCE } from '../ports/service-sales-fact-source.port';
import type {
    ServiceSalesFactErpAggregate,
    ServiceSalesFactSourcePort,
} from '../ports/service-sales-fact-source.port';
import type { SalesPerformanceReaderPort } from '../ports/sales-performance.port';
import { SalesFact } from '../../domain/value-objects/sales-fact.value-object';
import { SalesPrognose } from '@/shared/domain/sales-prognose.value-object';
import { SalesPerformance } from '../../domain/value-objects/sales-performance.value-object';
import { SalesPerformanceDirectionNotSupportedException } from '../../domain/exceptions/sales-performance.exception';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

// Единственная реализация SalesPerformanceReaderPort (Фаза 5) — план
// никогда не бывает пустым (переиспользует то же ленивое достраивание
// Фазы 4, что и ListSalesPlansService), факт агрегируется одним запросом
// на весь период (ServiceSalesFactSourcePort), прогноз считается по нему
// же через единую формулу SalesPrognose.forPeriod().
//
// spec: service/sales#requirement-факт-и-прогноз-продаж-не-персистятся-и-пересчитываются-на-каждый-запрос
// spec: service/sales#scenario-удаление-строки-плана-убирает-её-из-отчёта-фактпрогноз
@Injectable()
export class GetSalesPerformanceService implements SalesPerformanceReaderPort {
    constructor(
        private readonly ensureSalesPlans: EnsureSalesPlansForPeriodService,
        @Inject(SERVICE_SALES_FACT_SOURCE)
        private readonly factSource: ServiceSalesFactSourcePort,
    ) {}

    async listForPeriod(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPerformance[]> {
        // spec: service/sales#requirement-факт-и-прогноз-продаж-поддерживаются-только-для-направления-сервис
        //
        // Источник ERP-факта для shop появится в Фазе 11.
        if (direction !== 'service') {
            throw new SalesPerformanceDirectionNotSupportedException(direction);
        }

        const periodVo = Period.create(period);
        const now = new Date();

        // ensureOrdered — те же строки плана, что и ensure(), но уже
        // отсортированные по сохранённому глобальному порядку строк (см.
        // EnsureSalesPlansForPeriodService.ensureOrdered) — .map() ниже
        // сохраняет этот порядок в результирующем массиве.
        const [orderedPlans, facts] = await Promise.all([
            this.ensureSalesPlans.ensureOrdered(direction, period),
            this.factSource.aggregate(period),
        ]);

        // Бакеты факта сгруппированы только по отделу здесь — какие из них
        // относятся к конкретной строке плана, решает сама строка ниже
        // через orderTypeIds, а не общий ключ scope, как раньше: один отдел
        // за период обычно даёт несколько бакетов (по одному на
        // встретившийся тип заказа).
        const factsByDepartment = new Map<
            number,
            ServiceSalesFactErpAggregate[]
        >();
        for (const fact of facts) {
            const bucket = factsByDepartment.get(fact.department) ?? [];
            bucket.push(fact);
            factsByDepartment.set(fact.department, bucket);
        }

        return orderedPlans.map(({ plan, sortOrder }) => {
            const departmentFacts =
                factsByDepartment.get(plan.department) ?? [];
            // spec: service/sales#requirement-типы-заказов-ограничивают-какие-данные-erp-попадают-в-факт-строки-плана
            const matching =
                plan.orderTypeIds.length === 0
                    ? departmentFacts
                    : departmentFacts.filter((bucket) =>
                          plan.orderTypeIds.includes(bucket.orderTypeId),
                      );
            const erp = matching.reduce(
                (sum, bucket) => ({
                    turnover: sum.turnover + bucket.turnover,
                    cost: sum.cost + bucket.cost,
                    quantity: sum.quantity + bucket.quantity,
                }),
                { turnover: 0, cost: 0, quantity: 0 },
            );
            const fact = SalesFact.calculate({
                turnover: erp.turnover,
                cost: erp.cost,
                quantity: erp.quantity,
                planTurnover: plan.turnover,
            });
            const prognose = SalesPrognose.forPeriod(
                {
                    turnover: fact.getTurnover(),
                    margin: fact.getMargin(),
                    quantity: fact.getQuantity(),
                },
                periodVo,
                plan.turnover,
                now,
            );
            return SalesPerformance.create(plan, fact, prognose, sortOrder);
        });
    }

    async findForScope(
        direction: SalesDirection,
        period: string,
        department: number,
        category: string | null,
    ): Promise<SalesPerformance | null> {
        const performances = await this.listForPeriod(direction, period);
        return (
            performances.find(
                (performance) =>
                    performance.getDepartment() === department &&
                    performance.getCategory() === category,
            ) ?? null
        );
    }
}
