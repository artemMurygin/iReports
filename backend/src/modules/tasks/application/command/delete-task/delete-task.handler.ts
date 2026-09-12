import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { DeleteTaskCommand } from './delete-task.command';

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<
    DeleteTaskCommand,
    void
> {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async execute(command: DeleteTaskCommand): Promise<void> {
        const task = await this.taskRepo.findById(command.taskId);
        if (!task) {
            throw new TaskNotFoundException();
        }
        await this.taskRepo.delete(command.taskId);
    }
}
