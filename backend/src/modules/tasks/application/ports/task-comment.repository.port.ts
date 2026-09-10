import type { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';

export interface TaskCommentRepositoryPort {
    // Сохраняет новый комментарий.
    insert(comment: TaskComment): Promise<void>;

    // Все комментарии задачи, в хронологическом порядке по возрастанию
    // createdAt.
    // spec: tasks/comments#requirement-комментарий-фиксирует-автора-время-и-текст
    findByTaskId(taskId: string): Promise<TaskComment[]>;
}

export const TASK_COMMENT_REPOSITORY = Symbol('TASK_COMMENT_REPOSITORY');
