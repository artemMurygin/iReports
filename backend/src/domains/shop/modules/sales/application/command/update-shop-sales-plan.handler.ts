import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { UpdateShopSalesPlanCommand } from './update-shop-sales-plan.command';
import { ShopSalesPlanNotFoundException } from '../../domain/exceptions/shop-sales-plan.exception';
import { SHOP_SALES_PLAN_REPOSITORY } from '../ports/shop-sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '../ports/shop-sales-plan.port';
import { toShopSalesPlanResponse } from '../mappers/to-shop-sales-plan-response';

// Зеркало domains/service/modules/sales/application/command/
// update-sales-plan.handler.ts (Фаза 7). Строка чужого направления никогда
// не попадёт сюда вообще: ShopSalesPlanRepository.findById фильтрует
// Prisma-запрос по direction: 'shop' (см. ShopSalesPlan, WHY), поэтому
// "план чужого направления" и "плана вообще нет" — одна и та же
// не найденная строка без отдельной проверки direction в хендлере.
@CommandHandler(UpdateShopSalesPlanCommand)
export class UpdateShopSalesPlanHandler implements ICommandHandler<
    UpdateShopSalesPlanCommand,
    SalesPlanResponse
> {
    constructor(
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly repo: ShopSalesPlanRepositoryPort,
    ) {}

    async execute(
        command: UpdateShopSalesPlanCommand,
    ): Promise<SalesPlanResponse> {
        const plan = await this.repo.findById(command.planId);
        if (!plan) {
            throw new ShopSalesPlanNotFoundException();
        }

        plan.edit({
            turnover: command.turnover,
            margin: command.margin,
            orderTypeIds: command.orderTypeIds,
        });
        await this.repo.update(plan);

        return toShopSalesPlanResponse(plan);
    }
}
