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

function scopeKey(department: number, category: string | null): string {
    return `${department}:${category ?? 'null'}`;
}

// Единственная реализация SalesPerformanceReaderPort (Фаза 5) — план
// никогда не бывает пустым (переиспользует то же ленивое достраивание
// Фазы 4, что и ListSalesPlansService), факт агрегируется одним запросом
// на весь период (ServiceSalesFactSourcePort), прогноз считается по нему
// же через единую формулу SalesPrognose.forPeriod(). Ни факт, ни прогноз
// нигде не персистятся — пересчёт на каждый вызов и есть тот механизм,
// которым "изменение плана пересчитывает факт и прогноз", а "удаление
// плана удаляет факт и прогноз" (строка планов просто перестаёт попадать
// в результат) — см. "Когда готово" Фазы 5.
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
        // См. SalesPerformanceDirectionNotSupportedException — источник
        // ERP-факта для shop появится в Фазе 11.
        if (direction !== 'service') {
            throw new SalesPerformanceDirectionNotSupportedException(direction);
        }

        const periodVo = Period.create(period);
        const now = new Date();

        const [plans, facts] = await Promise.all([
            this.ensureSalesPlans.ensure(direction, period),
            this.factSource.aggregate(period),
        ]);

        const factsByScope = new Map<string, ServiceSalesFactErpAggregate>(
            facts.map((fact) => [
                scopeKey(fact.department, fact.category),
                fact,
            ]),
        );

        return plans.map((plan) => {
            const erp = factsByScope.get(
                scopeKey(plan.department, plan.category),
            );
            const fact = SalesFact.calculate({
                turnover: erp?.turnover ?? 0,
                cost: erp?.cost ?? 0,
                quantity: erp?.quantity ?? 0,
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
            return SalesPerformance.create(plan, fact, prognose);
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
