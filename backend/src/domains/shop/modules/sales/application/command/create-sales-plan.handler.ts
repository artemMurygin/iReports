import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { CreateShopSalesPlanCommand } from './create-sales-plan.command';
import { ShopSalesPlan } from '../../domain/entities/sales-plan.entity';
import { ShopSalesPlanAlreadyExistsException } from '../../domain/exceptions/sales-plan.exception';
import { SHOP_SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { toShopSalesPlanResponse } from '../mappers/to-sales-plan-response';

// Зеркало domains/service/modules/sales/application/command/
// create-sales-plan.handler.ts (Фаза 7 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop, собственный SHOP_SALES_PLAN_REPOSITORY,
// без переиспользования CommandBus/хендлера direction'а service.
@CommandHandler(CreateShopSalesPlanCommand)
export class CreateShopSalesPlanHandler implements ICommandHandler<
    CreateShopSalesPlanCommand,
    SalesPlanResponse[]
> {
    constructor(
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly repo: ShopSalesPlanRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(
        command: CreateShopSalesPlanCommand,
    ): Promise<SalesPlanResponse[]> {
        // spec: shop/sales#requirement-дубли-строк-плана-в-одном-запросе-создания-отклоняются-целиком
        this.assertNoDuplicatesWithinRequest(command.plans);

        // Все строки батча создаются атомарно — см. WHY в сервисном
        // зеркале (CreateSalesPlanHandler).
        return this.unitOfWork.run(async () => {
            const created: SalesPlanResponse[] = [];

            for (const item of command.plans) {
                const category = item.category ?? null;

                const existing = await this.repo.findByScope(
                    item.department,
                    category,
                    item.period,
                );
                if (existing) {
                    throw new ShopSalesPlanAlreadyExistsException(
                        `План на ${item.period} для отдела ${item.department}` +
                            (category !== null
                                ? `, категория ${category}`
                                : '') +
                            ' уже существует',
                    );
                }

                // Этот эндпоинт — единственный способ вручную завести план,
                // поэтому source всегда MANUAL.
                const plan = ShopSalesPlan.create({
                    department: item.department,
                    category,
                    period: item.period,
                    turnover: item.turnover,
                    margin: item.margin,
                    orderTypeIds: item.orderTypeIds,
                    source: 'MANUAL',
                });

                await this.repo.insert(plan);
                created.push(toShopSalesPlanResponse(plan));
            }

            return created;
        });
    }

    private assertNoDuplicatesWithinRequest(
        plans: CreateShopSalesPlanCommand['plans'],
    ): void {
        const seen = new Set<string>();
        for (const item of plans) {
            const category = item.category ?? null;
            const scopeKey = [item.department, category, item.period].join(':');

            if (seen.has(scopeKey)) {
                throw new ShopSalesPlanAlreadyExistsException(
                    `План на ${item.period} для отдела ${item.department}` +
                        (category !== null ? `, категория ${category}` : '') +
                        ' указан в запросе более одного раза',
                );
            }
            seen.add(scopeKey);
        }
    }
}
