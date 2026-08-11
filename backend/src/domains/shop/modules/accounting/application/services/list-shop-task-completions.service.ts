import { Inject, Injectable } from '@nestjs/common';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { toShopTaskCompletionResponse } from '@/domains/shop/modules/accounting/application/mappers/to-shop-task-completion-response';

@Injectable()
export class ListShopTaskCompletionsService {
    constructor(
        @Inject(SHOP_TASK_COMPLETION_REPOSITORY)
        private readonly repo: ShopTaskCompletionRepositoryPort,
    ) {}

    async execute(
        period: string,
        employeeId?: number,
    ): Promise<TaskCompletionResponse[]> {
        const completions = await this.repo.findByPeriod(period, employeeId);
        return completions.map(toShopTaskCompletionResponse);
    }
}
