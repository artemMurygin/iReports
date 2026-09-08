import type { AccountingDirection } from '@/shared/domain/calculation-context';
import type { Task } from '@/modules/tasks/domain/entities/task.entity';
import type { TaskStatusCode } from '@/modules/tasks/domain/value-objects/task-status.value-object';

export interface TaskListFilter {
    status?: TaskStatusCode;
    direction?: AccountingDirection;
}

export interface TaskRepositoryPort {
    insert(task: Task): Promise<void>;
    update(task: Task): Promise<void>;
    findById(id: string): Promise<Task | null>;

    // Единственный метод, который accounting (service/shop) вызывает
    // НАПРЯМУЮ, без Port/Adapter поверх (design.md Decision 5) — собирает
    // taskId из config.taskIdByPeriod своих правил и строит SalaryTask на
    // месте. Пустой список — [] без похода в БД (по прецеденту
    // WorkScheduleEntryRepository.findByEmployeeIdsAndDateRange).
    findManyByIds(ids: string[]): Promise<Task[]>;

    // Список /tasks — фильтр по статусу/направлению (оба необязательны).
    findMany(filter: TaskListFilter): Promise<Task[]>;
}

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');
