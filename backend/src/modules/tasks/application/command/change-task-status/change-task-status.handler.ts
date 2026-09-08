import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { ChangeTaskStatusCommand } from './change-task-status.command';

@CommandHandler(ChangeTaskStatusCommand)
export class ChangeTaskStatusHandler implements ICommandHandler<
    ChangeTaskStatusCommand,
    void
> {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async execute(command: ChangeTaskStatusCommand): Promise<void> {
        const task = await this.taskRepo.findById(command.taskId);
        if (!task) {
            throw new TaskNotFoundException();
        }
        // InvalidTaskTransitionException бросается ДО любой мутации
        // (Task.transitionTo) — если недопустим, repo.update() ниже не
        // вызывается, состояние не персистится (specs/tasks/spec.md,
        // Requirement: «Жизненный цикл статуса задачи», сценарий
        // «Недопустимый переход отклоняется»).
        task.transitionTo(
            TaskStatus.fromCode(command.targetStatus),
            command.actorEmployeeId,
        );
        await this.taskRepo.update(task);
    }
}
