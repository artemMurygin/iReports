import { Inject, Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import {
    DEFAULT_GROWTH_PERCENT,
    SalesPlanTemplate,
} from '../../domain/entities/sales-plan-template.entity';
import type { SalesDirection } from '../../domain/types/sales-plan.types';
import {
    orderSalesPlansByTemplate,
    type OrderedSalesPlan,
} from '../../domain/services/order-sales-plans';

function scopeKey(department: number, category: string | null): string {
    return `${department}:${category ?? 'null'}`;
}

// Плановые суммы хранятся как Int (см. sales.prisma) — округляем сразу
// после начисления процента роста.
function growBy(value: number, growthPercent: number): number {
    return Math.round(value * (1 + growthPercent / 100));
}

// Идемпотентное достраивание плана месяца — общая операция для крона
// первого числа (SalesPlanAutoCreationCron) и ленивого достраивания при
// первом обращении к периоду (ListSalesPlansService); см. Фазу 4,
// docs/payroll/plan-payroll-calculation.md. План месяца никогда не бывает
// пустым: для каждой комбинации (department, category), встречавшейся в
// плане предыдущего месяца или в шаблоне, но отсутствующей в текущем
// периоде, создаётся строка — из предыдущего плана + growthPercent
// (source = PREVIOUS_MONTH), а если предыдущего плана для этой комбинации
// нет — из шаблона без надбавки (source = TEMPLATE). Уже существующие
// строки периода не трогаются вне зависимости от статуса и источника
// (в том числе APPROVED и MANUAL) — это и делает операцию идемпотентной.
@Injectable()
export class EnsureSalesPlansForPeriodService {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly planRepo: SalesPlanRepositoryPort,
        @Inject(SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly templateRepo: SalesPlanTemplateRepositoryPort,
    ) {}

    async ensure(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPlan[]> {
        const existingPlans = await this.planRepo.findByDirectionAndPeriod(
            direction,
            period,
        );
        const existingScopes = new Set(
            existingPlans.map((plan) =>
                scopeKey(plan.department, plan.category),
            ),
        );

        const previousPeriod = Period.create(period).previous().getValue();
        const [previousPlans, templates] = await Promise.all([
            this.planRepo.findByDirectionAndPeriod(direction, previousPeriod),
            this.templateRepo.findAll(direction),
        ]);

        const previousByScope = new Map(
            previousPlans.map((plan) => [
                scopeKey(plan.department, plan.category),
                plan,
            ]),
        );
        const templateByScope = new Map(
            templates.map((template) => [
                scopeKey(template.department, template.category),
                template,
            ]),
        );

        const scopesToEnsure = new Set([
            ...previousByScope.keys(),
            ...templateByScope.keys(),
        ]);

        let createdAny = false;
        for (const scope of scopesToEnsure) {
            // Строка уже есть в текущем периоде (в любом статусе/источнике)
            // — не перезатираем, идемпотентность именно в этом.
            if (existingScopes.has(scope)) {
                continue;
            }

            const previous = previousByScope.get(scope);
            const template = templateByScope.get(scope);
            const plan = previous
                ? this.fromPreviousMonth(direction, period, previous, template)
                : // scopesToEnsure построен как объединение ключей обеих
                  // Map, поэтому если previous нет, template точно есть.
                  this.fromTemplate(direction, period, template!);

            // Последняя линия защиты от гонки параллельных вызовов (крон +
            // конкурентный ленивый триггер) — @@unique в sales.prisma, как
            // и в CreateSalesPlanHandler; отдельно её здесь не ловим.
            await this.planRepo.insert(plan);
            createdAny = true;
        }

        if (!createdAny) {
            return existingPlans;
        }

        // Перечитываем из репозитория, а не мержим объекты вручную — проще
        // и гарантирует тот же порядок (department, category), что и без
        // достраивания.
        return this.planRepo.findByDirectionAndPeriod(direction, period);
    }

    // Тот же набор строк, что и ensure(), но отсортированный по
    // сохранённому глобальному порядку (SalesPlanTemplate.sortOrder, см.
    // domain/services/order-sales-plans.ts) — используется потребителями,
    // отдающими список строк наружу (ListSalesPlansService,
    // GetSalesPerformanceService). Отдельный от ensure() метод — крону
    // (SalesPlanAutoCreationCron) и уже существующим тестам порядок не
    // нужен, а лишний findAll() шаблонов на каждый его тик ни к чему.
    async ensureOrdered(
        direction: SalesDirection,
        period: string,
    ): Promise<OrderedSalesPlan[]> {
        const [plans, templates] = await Promise.all([
            this.ensure(direction, period),
            this.templateRepo.findAll(direction),
        ]);
        return orderSalesPlansByTemplate(plans, templates);
    }

    private fromPreviousMonth(
        direction: SalesDirection,
        period: string,
        previous: SalesPlan,
        template: SalesPlanTemplate | undefined,
    ): SalesPlan {
        const growthPercent = template?.growthPercent ?? DEFAULT_GROWTH_PERCENT;
        return SalesPlan.create({
            direction,
            department: previous.department,
            category: previous.category,
            period,
            turnover: growBy(previous.turnover, growthPercent),
            margin: growBy(previous.margin, growthPercent),
            orderTypeIds: previous.orderTypeIds,
            source: 'PREVIOUS_MONTH',
        });
    }

    private fromTemplate(
        direction: SalesDirection,
        period: string,
        template: SalesPlanTemplate,
    ): SalesPlan {
        return SalesPlan.create({
            direction,
            department: template.department,
            category: template.category,
            period,
            turnover: template.turnover,
            margin: template.margin,
            orderTypeIds: template.orderTypeIds,
            source: 'TEMPLATE',
        });
    }
}
