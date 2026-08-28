import { Inject, Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { SalesPrognose } from '@/shared/domain/sales-prognose.value-object';
import { EnsureShopSalesPlansForPeriodService } from './ensure-shop-sales-plans-for-period.service';
import { SHOP_SALES_FACT_SOURCE } from '../ports/shop-sales-fact-source.port';
import type {
    ShopSalesFactErpAggregate,
    ShopSalesFactSourcePort,
} from '../ports/shop-sales-fact-source.port';
import type { ShopSalesPerformanceReaderPort } from '../ports/shop-sales-performance.port';
import { ShopSalesFact } from '../../domain/value-objects/shop-sales-fact.value-object';
import { ShopSalesPerformance } from '../../domain/value-objects/shop-sales-performance.value-object';

function scopeKey(department: number, category: string | null): string {
    return `${department}:${category ?? 'null'}`;
}

// Единственная реализация ShopSalesPerformanceReaderPort (Фаза 11) —
// зеркало GetSalesPerformanceService направления service. План никогда не
// бывает пустым (переиспользует то же ленивое достраивание, что у
// направления service, но собственным независимым сервисом —
// EnsureShopSalesPlansForPeriodService, Фаза 7
// docs/service-shop-boundary-violations-fix), факт агрегируется одним
// запросом на весь период (ShopSalesFactSourcePort), прогноз считается по
// нему же через единую формулу SalesPrognose.forPeriod(). Ни факт, ни
// прогноз нигде не персистятся — пересчёт на каждый вызов и есть тот
// механизм, которым "изменение плана пересчитывает факт и прогноз", а
// "удаление плана удаляет факт и прогноз" (строка плана просто перестаёт
// попадать в результат).
@Injectable()
export class GetShopSalesPerformanceService implements ShopSalesPerformanceReaderPort {
    constructor(
        private readonly ensureSalesPlans: EnsureShopSalesPlansForPeriodService,
        @Inject(SHOP_SALES_FACT_SOURCE)
        private readonly factSource: ShopSalesFactSourcePort,
    ) {}

    async listForPeriod(period: string): Promise<ShopSalesPerformance[]> {
        const periodVo = Period.create(period);
        const now = new Date();

        const plans = await this.ensureSalesPlans.ensure(period);

        const categories = [
            ...new Set(
                plans
                    .map((plan) => plan.category)
                    .filter(
                        (category): category is string => category !== null,
                    ),
            ),
        ];

        const facts = await this.factSource.aggregate(period, categories);

        const factsByScope = new Map<string, ShopSalesFactErpAggregate>(
            facts.map((fact) => [
                scopeKey(fact.department, fact.category),
                fact,
            ]),
        );

        return plans.map((plan) => {
            const erp = factsByScope.get(
                scopeKey(plan.department, plan.category),
            );
            const fact = ShopSalesFact.calculate({
                turnover: erp?.turnover ?? 0,
                margin: erp?.margin ?? 0,
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
            return ShopSalesPerformance.create(plan, fact, prognose);
        });
    }

    async findForScope(
        period: string,
        department: number,
        category: string | null,
    ): Promise<ShopSalesPerformance | null> {
        const performances = await this.listForPeriod(period);
        return (
            performances.find(
                (performance) =>
                    performance.getDepartment() === department &&
                    performance.getCategory() === category,
            ) ?? null
        );
    }

    async listForDepartment(
        period: string,
        department: number,
    ): Promise<ShopSalesPerformance[]> {
        const performances = await this.listForPeriod(period);
        return performances.filter(
            (performance) => performance.getDepartment() === department,
        );
    }
}
