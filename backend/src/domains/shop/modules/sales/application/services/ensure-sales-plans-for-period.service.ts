import { Inject, Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { SHOP_SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { ShopSalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { ShopSalesPlan } from '../../domain/entities/sales-plan.entity';
import {
    DEFAULT_GROWTH_PERCENT,
    ShopSalesPlanTemplate,
} from '../../domain/entities/sales-plan-template.entity';
import {
    orderShopSalesPlansByTemplate,
    type OrderedShopSalesPlan,
} from '../../domain/services/order-sales-plans';

function scopeKey(department: number, category: string | null): string {
    return `${department}:${category ?? 'null'}`;
}

// Плановые суммы хранятся как Int (см. sales.prisma) — округляем сразу
// после начисления процента роста.
function growBy(value: number, growthPercent: number): number {
    return Math.round(value * (1 + growthPercent / 100));
}

// Зеркало domains/service/modules/sales/application/services/
// ensure-sales-plans-for-period.service.ts (Фаза 7
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop, без параметра direction (зафиксирован реализацией
// репозиториев). Идемпотентное достраивание плана месяца — общая операция
// для крона первого числа (ShopSalesPlanAutoCreationCron) и ленивого
// достраивания при первом обращении к периоду (ListShopSalesPlansService/
// GetShopSalesPerformanceService). План месяца никогда не бывает пустым:
// для каждой комбинации (department, category), встречавшейся в плане
// предыдущего месяца или в шаблоне, но отсутствующей в текущем периоде,
// создаётся строка — из предыдущего плана + growthPercent
// (source = PREVIOUS_MONTH), а если предыдущего плана для этой комбинации
// нет — из шаблона без надбавки (source = TEMPLATE). Уже существующие
// строки периода не трогаются вне зависимости от статуса и источника.
@Injectable()
export class EnsureShopSalesPlansForPeriodService {
    constructor(
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly planRepo: ShopSalesPlanRepositoryPort,
        @Inject(SHOP_SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly templateRepo: ShopSalesPlanTemplateRepositoryPort,
    ) {}

    async ensure(period: string): Promise<ShopSalesPlan[]> {
        const existingPlans = await this.planRepo.findByPeriod(period);
        const existingScopes = new Set(
            existingPlans.map((plan) =>
                scopeKey(plan.department, plan.category),
            ),
        );

        const previousPeriod = Period.create(period).previous().getValue();
        const [previousPlans, templates] = await Promise.all([
            this.planRepo.findByPeriod(previousPeriod),
            this.templateRepo.findAll(),
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
                ? this.fromPreviousMonth(period, previous, template)
                : // scopesToEnsure построен как объединение ключей обеих
                  // Map, поэтому если previous нет, template точно есть.
                  this.fromTemplate(period, template!);

            // Последняя линия защиты от гонки параллельных вызовов (крон +
            // конкурентный ленивый триггер) — @@unique в sales.prisma, как
            // и в CreateShopSalesPlanHandler; отдельно её здесь не ловим.
            await this.planRepo.insert(plan);
            createdAny = true;
        }

        if (!createdAny) {
            return existingPlans;
        }

        // Перечитываем из репозитория, а не мержим объекты вручную — проще
        // и гарантирует тот же порядок (department, category), что и без
        // достраивания.
        return this.planRepo.findByPeriod(period);
    }

    // Тот же набор строк, что и ensure(), но отсортированный по
    // сохранённому глобальному порядку (ShopSalesPlanTemplate.sortOrder,
    // см. domain/services/order-sales-plans.ts) — используется
    // потребителями, отдающими список строк наружу
    // (ListShopSalesPlansService, GetShopSalesPerformanceService). Зеркало
    // EnsureSalesPlansForPeriodService.ensureOrdered() направления service
    // (Фаза 4, docs/sales-plan-row-drag-and-drop-reorder). Отдельный от
    // ensure() метод — крону (ShopSalesPlanAutoCreationCron) порядок не
    // нужен, а лишний findAll() шаблонов на каждый его тик ни к чему.
    async ensureOrdered(period: string): Promise<OrderedShopSalesPlan[]> {
        const [plans, templates] = await Promise.all([
            this.ensure(period),
            this.templateRepo.findAll(),
        ]);
        return orderShopSalesPlansByTemplate(plans, templates);
    }

    private fromPreviousMonth(
        period: string,
        previous: ShopSalesPlan,
        template: ShopSalesPlanTemplate | undefined,
    ): ShopSalesPlan {
        const growthPercent = template?.growthPercent ?? DEFAULT_GROWTH_PERCENT;
        return ShopSalesPlan.create({
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
        period: string,
        template: ShopSalesPlanTemplate,
    ): ShopSalesPlan {
        return ShopSalesPlan.create({
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
