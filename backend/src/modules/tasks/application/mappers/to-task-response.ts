import type { Task as TaskContract } from 'ireports-contracts';
import type { Task } from '@/modules/tasks/domain/entities/task.entity';

// Task (ответ API) — contracts/commands/task.ts. Даты — нативные Date
// (контракт использует z.coerce.date() для ответа, не ISO-строку — тот же
// приём, что toBalanceTransactionResponse/BalanceTransaction.occurredAt).
export function toTaskResponse(task: Task): TaskContract {
    return {
        id: task.id,
        direction: task.direction,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        assigneeEmployeeId: task.assigneeEmployeeId,
        status: task.status.code,
        closedSuccessfullyAt: task.closedSuccessfullyAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
    };
}
