import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { CreateTaskCompletionCommand } from './create-task-completion.command';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/task-completion.entity';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import type { TaskCompletionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { TaskCompletionMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/task-completion/task-completion.mapper';

@CommandHandler(CreateTaskCompletionCommand)
export class CreateTaskCompletionHandler implements ICommandHandler<
    CreateTaskCompletionCommand,
    TaskCompletionResponse
> {
    private readonly mapper = new TaskCompletionMapper();

    constructor(
        @Inject(TASK_COMPLETION_REPOSITORY)
        private readonly repo: TaskCompletionRepositoryPort,
    ) {}

    async execute(
        command: CreateTaskCompletionCommand,
    ): Promise<TaskCompletionResponse> {
        const completion = TaskCompletion.create({
            employeeId: command.employeeId,
            period: command.period,
            description: command.description,
            createdBy: command.createdBy,
        });

        await this.repo.insert(completion);

        return this.mapper.toResponse(completion);
    }
}
