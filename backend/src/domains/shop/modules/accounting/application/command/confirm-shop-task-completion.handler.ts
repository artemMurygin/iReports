import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { ConfirmShopTaskCompletionCommand } from './confirm-shop-task-completion.command';
import { ShopTaskCompletionNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-task-completion.exception';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { toShopTaskCompletionResponse } from '@/domains/shop/modules/accounting/application/mappers/to-shop-task-completion-response';

@CommandHandler(ConfirmShopTaskCompletionCommand)
export class ConfirmShopTaskCompletionHandler implements ICommandHandler<
    ConfirmShopTaskCompletionCommand,
    TaskCompletionResponse
> {
    constructor(
        @Inject(SHOP_TASK_COMPLETION_REPOSITORY)
        private readonly repo: ShopTaskCompletionRepositoryPort,
    ) {}

    async execute(
        command: ConfirmShopTaskCompletionCommand,
    ): Promise<TaskCompletionResponse> {
        const completion = await this.repo.findById(command.taskCompletionId);
        if (!completion) {
            throw new ShopTaskCompletionNotFoundException();
        }

        if (command.approve) {
            completion.confirm(command.confirmedBy);
        } else {
            completion.reject(command.confirmedBy);
        }

        await this.repo.update(completion);

        return toShopTaskCompletionResponse(completion);
    }
}
