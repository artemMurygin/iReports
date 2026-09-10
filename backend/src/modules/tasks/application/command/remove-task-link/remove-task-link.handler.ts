import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_LINK_REPOSITORY } from '@/modules/tasks/application/ports/task-link.repository.port';
import type { TaskLinkRepositoryPort } from '@/modules/tasks/application/ports/task-link.repository.port';
import { TaskLinkNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { RemoveTaskLinkCommand } from './remove-task-link.command';

// spec: tasks/links#Requirement: Ссылка удаляется из карточки задачи
@CommandHandler(RemoveTaskLinkCommand)
export class RemoveTaskLinkHandler implements ICommandHandler<
    RemoveTaskLinkCommand,
    void
> {
    constructor(
        @Inject(TASK_LINK_REPOSITORY)
        private readonly taskLinkRepo: TaskLinkRepositoryPort,
    ) {}

    async execute(command: RemoveTaskLinkCommand): Promise<void> {
        // Ссылка удаляется, только если принадлежит указанной задаче —
        // чужая/несуществующая ссылка отклоняется ДО вызова
        // TaskLinkRepositoryPort.delete, остальные ссылки задачи не
        // затрагиваются (architecture.md: «удаляет ссылку, если она
        // принадлежит задаче»).
        const links = await this.taskLinkRepo.findByTaskId(command.taskId);
        const link = links.find((l) => l.id === command.linkId);
        if (!link) {
            throw new TaskLinkNotFoundException();
        }
        await this.taskLinkRepo.delete(command.linkId);
    }
}
