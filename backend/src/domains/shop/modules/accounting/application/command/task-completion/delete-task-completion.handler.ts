import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteShopTaskCompletionCommand } from './delete-task-completion.command';
import { ShopTaskCompletionNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/task-completion.exception';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';

@CommandHandler(DeleteShopTaskCompletionCommand)
export class DeleteShopTaskCompletionHandler implements ICommandHandler<
    DeleteShopTaskCompletionCommand,
    void
> {
    constructor(
        @Inject(SHOP_TASK_COMPLETION_REPOSITORY)
        private readonly repo: ShopTaskCompletionRepositoryPort,
    ) {}

    async execute(command: DeleteShopTaskCompletionCommand): Promise<void> {
        const completion = await this.repo.findById(command.taskCompletionId);
        if (!completion) {
            throw new ShopTaskCompletionNotFoundException();
        }

        await this.repo.delete(command.taskCompletionId);
    }
}
