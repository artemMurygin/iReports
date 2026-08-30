import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { CreateShopTaskCompletionCommand } from './create-task-completion.command';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/task-completion/task-completion.entity';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import { ShopTaskCompletionMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/task-completion/task-completion.mapper';

@CommandHandler(CreateShopTaskCompletionCommand)
export class CreateShopTaskCompletionHandler implements ICommandHandler<
    CreateShopTaskCompletionCommand,
    TaskCompletionResponse
> {
    private readonly mapper = new ShopTaskCompletionMapper();

    constructor(
        @Inject(SHOP_TASK_COMPLETION_REPOSITORY)
        private readonly repo: ShopTaskCompletionRepositoryPort,
    ) {}

    async execute(
        command: CreateShopTaskCompletionCommand,
    ): Promise<TaskCompletionResponse> {
        const completion = ShopTaskCompletion.create({
            employeeId: command.employeeId,
            period: command.period,
            description: command.description,
            createdBy: command.createdBy,
        });

        await this.repo.insert(completion);

        return this.mapper.toResponse(completion);
    }
}
