import { Inject, Injectable } from '@nestjs/common';
import type { TaskComment as TaskCommentContract } from 'ireports-contracts';
import { TASK_COMMENT_REPOSITORY } from '@/modules/tasks/application/ports/task-comment.repository.port';
import type { TaskCommentRepositoryPort } from '@/modules/tasks/application/ports/task-comment.repository.port';
import { toTaskCommentResponse } from '../mappers/to-task-comment-response';

// GET /v1/tasks/:id/comments — spec: tasks/comments#Requirement: Комментарий
// фиксирует автора, время и текст. Хронологический порядок обеспечивает
// TaskCommentRepositoryPort.findByTaskId (по возрастанию createdAt).
@Injectable()
export class ListTaskCommentsService {
    constructor(
        @Inject(TASK_COMMENT_REPOSITORY)
        private readonly taskCommentRepo: TaskCommentRepositoryPort,
    ) {}

    async execute(taskId: string): Promise<TaskCommentContract[]> {
        const comments = await this.taskCommentRepo.findByTaskId(taskId);
        return comments.map(toTaskCommentResponse);
    }
}
