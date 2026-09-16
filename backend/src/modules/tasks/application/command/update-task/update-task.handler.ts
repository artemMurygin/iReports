import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { UpdateTaskCommand } from './update-task.command';

@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<
    UpdateTaskCommand,
    void
> {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async execute(command: UpdateTaskCommand): Promise<void> {
        const task = await this.taskRepo.findById(command.taskId);
        if (!task) {
            throw new TaskNotFoundException();
        }
        // TaskAlreadyClosedException бросается ДО любой мутации (Task.update)
        // — если задача терминальна, repo.update() ниже не вызывается,
        // состояние не персистится (тот же принцип, что у
        // ChangeTaskStatusHandler/InvalidTaskTransitionException).
        task.update({
            title: command.title,
            description: command.description,
            deadline: command.deadline,
            assigneeEmployeeId: command.assigneeEmployeeId,
        });
        await this.taskRepo.update(task);
    }
}
