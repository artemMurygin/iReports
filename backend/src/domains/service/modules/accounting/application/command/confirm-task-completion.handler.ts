import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { ConfirmTaskCompletionCommand } from './confirm-task-completion.command';
import { TaskCompletionNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/task-completion.exception';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import type { TaskCompletionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { TaskCompletionMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/task-completion/task-completion.mapper';

@CommandHandler(ConfirmTaskCompletionCommand)
export class ConfirmTaskCompletionHandler implements ICommandHandler<
    ConfirmTaskCompletionCommand,
    TaskCompletionResponse
> {
    private readonly mapper = new TaskCompletionMapper();

    constructor(
        @Inject(TASK_COMPLETION_REPOSITORY)
        private readonly repo: TaskCompletionRepositoryPort,
    ) {}

    async execute(
        command: ConfirmTaskCompletionCommand,
    ): Promise<TaskCompletionResponse> {
        const completion = await this.repo.findById(command.taskCompletionId);
        if (!completion) {
            throw new TaskCompletionNotFoundException();
        }

        if (command.approve) {
            completion.confirm(command.confirmedBy);
        } else {
            completion.reject(command.confirmedBy);
        }

        await this.repo.update(completion);

        return this.mapper.toResponse(completion);
    }
}
