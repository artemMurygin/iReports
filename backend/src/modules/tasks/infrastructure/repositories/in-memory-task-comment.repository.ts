import { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';
import type { TaskCommentRepositoryPort } from '@/modules/tasks/application/ports/task-comment.repository.port';

// In-memory реализация TaskCommentRepositoryPort для юнит-тестов
// (тот же приём, что InMemoryTaskRepository).
export class InMemoryTaskCommentRepository implements TaskCommentRepositoryPort {
    readonly store = new Map<string, TaskComment>();

    insert(comment: TaskComment): Promise<void> {
        this.store.set(comment.id, comment);
        return Promise.resolve();
    }

    // spec: tasks/comments#requirement-комментарий-фиксирует-автора-время-и-текст —
    // хронологический порядок (от старого к новому).
    findByTaskId(taskId: string): Promise<TaskComment[]> {
        return Promise.resolve(
            [...this.store.values()]
                .filter((comment) => comment.taskId === taskId)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        );
    }
}
