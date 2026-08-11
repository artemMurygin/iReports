import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteTaskCompletionCommand } from './delete-task-completion.command';
import { TaskCompletionNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/task-completion.exception';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import type { TaskCompletionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/task-completion.port';

@CommandHandler(DeleteTaskCompletionCommand)
export class DeleteTaskCompletionHandler implements ICommandHandler<
    DeleteTaskCompletionCommand,
    void
> {
    constructor(
        @Inject(TASK_COMPLETION_REPOSITORY)
        private readonly repo: TaskCompletionRepositoryPort,
    ) {}

    async execute(command: DeleteTaskCompletionCommand): Promise<void> {
        const completion = await this.repo.findById(command.taskCompletionId);
        if (!completion) {
            throw new TaskCompletionNotFoundException();
        }

        await this.repo.delete(command.taskCompletionId);
    }
}
