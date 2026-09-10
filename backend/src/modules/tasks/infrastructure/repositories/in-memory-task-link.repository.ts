import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import type { TaskLinkRepositoryPort } from '@/modules/tasks/application/ports/task-link.repository.port';

// In-memory реализация TaskLinkRepositoryPort для юнит-тестов
// (тот же приём, что InMemoryTaskRepository).
export class InMemoryTaskLinkRepository implements TaskLinkRepositoryPort {
    readonly store = new Map<string, TaskLink>();

    insert(link: TaskLink): Promise<void> {
        this.store.set(link.id, link);
        return Promise.resolve();
    }

    findByTaskId(taskId: string): Promise<TaskLink[]> {
        return Promise.resolve(
            [...this.store.values()]
                .filter((link) => link.taskId === taskId)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        );
    }

    // spec: tasks/links#requirement-ссылка-удаляется-из-карточки-задачи
    delete(linkId: string): Promise<void> {
        this.store.delete(linkId);
        return Promise.resolve();
    }
}
