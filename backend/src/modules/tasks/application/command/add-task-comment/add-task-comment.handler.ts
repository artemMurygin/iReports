import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TASK_COMMENT_REPOSITORY } from '@/modules/tasks/application/ports/task-comment.repository.port';
import type { TaskCommentRepositoryPort } from '@/modules/tasks/application/ports/task-comment.repository.port';
import { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';
import { AddTaskCommentCommand } from './add-task-comment.command';

// spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и текст
@CommandHandler(AddTaskCommentCommand)
export class AddTaskCommentHandler implements ICommandHandler<
    AddTaskCommentCommand,
    TaskComment
> {
    constructor(
        @Inject(TASK_COMMENT_REPOSITORY)
        private readonly taskCommentRepo: TaskCommentRepositoryPort,
    ) {}

    async execute(command: AddTaskCommentCommand): Promise<TaskComment> {
        // TaskCommentBody.create (внутри TaskComment.create) бросает
        // TaskCommentBodyEmptyException ДО insert, если текст пуст/состоит
        // из пробелов — spec: tasks/comments#Requirement: Пустой комментарий
        // отклоняется.
        const comment = TaskComment.create({
            taskId: command.taskId,
            authorEmployeeId: command.authorEmployeeId,
            text: command.text,
        });
        await this.taskCommentRepo.insert(comment);
        return comment;
    }
}
