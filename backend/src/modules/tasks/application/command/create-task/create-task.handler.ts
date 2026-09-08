import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { CreateTaskCommand } from './create-task.command';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<
    CreateTaskCommand,
    { id: string }
> {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async execute(command: CreateTaskCommand): Promise<{ id: string }> {
        const task = Task.create({
            title: command.title,
            description: command.description,
            deadline: command.deadline,
            assigneeEmployeeId: command.assigneeEmployeeId,
            direction: command.direction,
        });
        await this.taskRepo.insert(task);
        return { id: task.id };
    }
}
