import { Task } from '@/modules/tasks/domain/entities/task.entity';
import type {
    TaskListFilter,
    TaskRepositoryPort,
} from '@/modules/tasks/application/ports/task.repository.port';

// In-memory реализация TaskRepositoryPort для юнит- и e2e-тестов
// (тот же приём, что InMemoryBalanceTransactionRepository/
// InMemorySalaryAccrualRepository).
export class InMemoryTaskRepository implements TaskRepositoryPort {
    readonly store = new Map<string, Task>();

    insert(task: Task): Promise<void> {
        this.store.set(task.id, task);
        return Promise.resolve();
    }

    update(task: Task): Promise<void> {
        this.store.set(task.id, task);
        return Promise.resolve();
    }

    findById(id: string): Promise<Task | null> {
        return Promise.resolve(this.store.get(id) ?? null);
    }

    findManyByIds(ids: string[]): Promise<Task[]> {
        return Promise.resolve(
            ids
                .map((id) => this.store.get(id))
                .filter((task): task is Task => task !== undefined),
        );
    }

    findMany(filter: TaskListFilter): Promise<Task[]> {
        return Promise.resolve(
            [...this.store.values()]
                .filter(
                    (task) =>
                        (!filter.status ||
                            task.status.code === filter.status) &&
                        (!filter.direction ||
                            task.direction === filter.direction),
                )
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        );
    }
}
