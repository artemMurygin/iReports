import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ApproveShopSalesPlanCommand } from './approve-shop-sales-plan.command';
import { ShopSalesPlan } from '../../domain/entities/shop-sales-plan.entity';
import { ShopSalesPlanNotFoundException } from '../../domain/exceptions/shop-sales-plan.exception';
import { SHOP_SALES_PLAN_REPOSITORY } from '../ports/shop-sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '../ports/shop-sales-plan.port';
import { toShopSalesPlanResponse } from '../mappers/to-shop-sales-plan-response';

// Зеркало domains/service/modules/sales/application/command/
// approve-sales-plan.handler.ts (Фаза 7). Утверждает набор строк —
// построчно (ids) или весь месяц (period). Идемпотентно: строки, уже
// находящиеся в APPROVED, не трогаются. В ветке ids id, принадлежащий
// направлению service, никогда не попадает в findByIds (репозиторий
// фильтрует по direction: 'shop' на уровне Prisma-запроса, см.
// ShopSalesPlanRepository) — поэтому он остаётся в missing наравне с
// отсутствующим id без отдельной проверки направления.
@CommandHandler(ApproveShopSalesPlanCommand)
export class ApproveShopSalesPlanHandler implements ICommandHandler<
    ApproveShopSalesPlanCommand,
    SalesPlanResponse[]
> {
    constructor(
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly repo: ShopSalesPlanRepositoryPort,
    ) {}

    async execute(
        command: ApproveShopSalesPlanCommand,
    ): Promise<SalesPlanResponse[]> {
        const targets = await this.resolveTargets(command);

        for (const plan of targets) {
            if (plan.status !== 'APPROVED') {
                plan.approve(command.approvedBy);
                await this.repo.update(plan);
            }
        }

        return targets.map(toShopSalesPlanResponse);
    }

    private async resolveTargets(
        command: ApproveShopSalesPlanCommand,
    ): Promise<ShopSalesPlan[]> {
        if (command.ids) {
            const plans = await this.repo.findByIds(command.ids);
            const byId = new Map(plans.map((plan) => [plan.id, plan]));

            const missing = command.ids.filter((id) => !byId.has(id));
            if (missing.length > 0) {
                throw new ShopSalesPlanNotFoundException(
                    `Не найдены строки плана: ${missing.join(', ')}`,
                );
            }
            return plans;
        }

        if (command.period) {
            return this.repo.findByPeriod(command.period);
        }

        throw new ArgumentInvalidException(
            'Нужно указать либо ids, либо период',
        );
    }
}
