import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteShopSalesPlanCommand } from './delete-shop-sales-plan.command';
import { ShopSalesPlanNotFoundException } from '../../domain/exceptions/shop-sales-plan.exception';
import { SHOP_SALES_PLAN_REPOSITORY } from '../ports/shop-sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '../ports/shop-sales-plan.port';

// Зеркало domains/service/modules/sales/application/command/
// delete-sales-plan.handler.ts (Фаза 7) — строка чужого направления
// трактуется как ненайденная тем же образом, что и в
// UpdateShopSalesPlanHandler (см. WHY там).
@CommandHandler(DeleteShopSalesPlanCommand)
export class DeleteShopSalesPlanHandler implements ICommandHandler<
    DeleteShopSalesPlanCommand,
    void
> {
    constructor(
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly repo: ShopSalesPlanRepositoryPort,
    ) {}

    async execute(command: DeleteShopSalesPlanCommand): Promise<void> {
        const plan = await this.repo.findById(command.planId);
        if (!plan) {
            throw new ShopSalesPlanNotFoundException();
        }

        await this.repo.delete(command.planId);
    }
}
