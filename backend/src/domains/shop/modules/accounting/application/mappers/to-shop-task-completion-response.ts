import type { TaskCompletionResponse } from 'ireports-contracts';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/shop-task-completion.entity';

export function toShopTaskCompletionResponse(
    completion: ShopTaskCompletion,
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
