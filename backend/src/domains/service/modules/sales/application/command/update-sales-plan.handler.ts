import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { UpdateSalesPlanCommand } from './update-sales-plan.command';
import { SalesPlanNotFoundException } from '../../domain/exceptions/sales-plan.exception';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { toSalesPlanResponse } from '../mappers/to-sales-plan-response';

// Правка значений — переводит source в MANUAL и, если строка была
// утверждена, сбрасывает status в CREATED (см. SalesPlan.edit()).
@CommandHandler(UpdateSalesPlanCommand)
export class UpdateSalesPlanHandler implements ICommandHandler<
    UpdateSalesPlanCommand,
    SalesPlanResponse
> {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly repo: SalesPlanRepositoryPort,
    ) {}

    async execute(command: UpdateSalesPlanCommand): Promise<SalesPlanResponse> {
        const plan = await this.repo.findById(command.planId);
        if (!plan) {
            throw new SalesPlanNotFoundException();
        }

        plan.edit({ turnover: command.turnover, margin: command.margin });
        await this.repo.update(plan);

        return toSalesPlanResponse(plan);
    }
}
