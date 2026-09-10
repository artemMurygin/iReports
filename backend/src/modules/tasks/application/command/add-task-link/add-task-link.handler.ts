import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_LINK_REPOSITORY } from '@/modules/tasks/application/ports/task-link.repository.port';
import type { TaskLinkRepositoryPort } from '@/modules/tasks/application/ports/task-link.repository.port';
import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import { AddTaskLinkCommand } from './add-task-link.command';

// spec: tasks/links#Requirement: Задача может иметь несколько ссылок
@CommandHandler(AddTaskLinkCommand)
export class AddTaskLinkHandler implements ICommandHandler<
    AddTaskLinkCommand,
    TaskLink
> {
    constructor(
        @Inject(TASK_LINK_REPOSITORY)
        private readonly taskLinkRepo: TaskLinkRepositoryPort,
    ) {}

    async execute(command: AddTaskLinkCommand): Promise<TaskLink> {
        // TaskLinkUrl.create (внутри TaskLink.create) бросает
        // InvalidTaskLinkUrlException ДО insert, если адрес синтаксически
        // невалиден — spec: tasks/links#Requirement: Ссылка должна быть
        // валидным адресом. insert только добавляет новую ссылку, уже
        // существующие ссылки задачи не затрагиваются.
        const link = TaskLink.create({
            taskId: command.taskId,
            url: command.url,
            label: command.label,
        });
        await this.taskLinkRepo.insert(link);
        return link;
    }
}
