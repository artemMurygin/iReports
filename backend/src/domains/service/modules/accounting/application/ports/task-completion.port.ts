import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/task-completion.entity';

export interface TaskCompletionRepositoryPort {
    insert(entity: TaskCompletion): Promise<void>;
    update(entity: TaskCompletion): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<TaskCompletion | null>;

    // Все записи периода (руководитель видит и подтверждает задачи всех
    // сотрудников месяца) либо только одного сотрудника, если указан.
    findByPeriod(
        period: string,
        employeeId?: number,
    ): Promise<TaskCompletion[]>;

    // Только подтверждённые записи периода — вход
    // BuildServiceCalculationContextService (Фаза 8, источник для
    // TaskCompletedEntity.calculate()).
    findConfirmedByPeriod(period: string): Promise<TaskCompletion[]>;
}

export const TASK_COMPLETION_REPOSITORY = Symbol('TASK_COMPLETION_REPOSITORY');
