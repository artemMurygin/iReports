import type { TaskCompletionResponse } from 'ireports-contracts';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/task-completion.entity';

export function toTaskCompletionResponse(
    completion: TaskCompletion,
): TaskCompletionResponse {
    return {
        id: completion.id,
        employeeId: completion.employeeId,
        period: completion.period,
        description: completion.description,
        status: completion.status,
        createdBy: completion.createdBy,
        createdAt: completion.createdAt,
        confirmedBy: completion.confirmedBy,
        confirmedAt: completion.confirmedAt,
        updatedAt: completion.updatedAt,
    };
}
