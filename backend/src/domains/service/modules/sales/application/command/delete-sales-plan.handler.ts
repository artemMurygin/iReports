import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteSalesPlanCommand } from './delete-sales-plan.command';
import { SalesPlanNotFoundException } from '../../domain/exceptions/sales-plan.exception';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';

@CommandHandler(DeleteSalesPlanCommand)
export class DeleteSalesPlanHandler implements ICommandHandler<
    DeleteSalesPlanCommand,
    void
> {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly repo: SalesPlanRepositoryPort,
    ) {}

    async execute(command: DeleteSalesPlanCommand): Promise<void> {
        const plan = await this.repo.findById(command.planId);
        if (!plan) {
            throw new SalesPlanNotFoundException();
        }

        await this.repo.delete(command.planId);
    }
}
