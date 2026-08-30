import { Inject, Injectable } from '@nestjs/common';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import { ShopTaskCompletionMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/task-completion/task-completion.mapper';

@Injectable()
export class ListShopTaskCompletionsService {
    private readonly mapper = new ShopTaskCompletionMapper();

    constructor(
        @Inject(SHOP_TASK_COMPLETION_REPOSITORY)
        private readonly repo: ShopTaskCompletionRepositoryPort,
    ) {}

    async execute(
        period: string,
        employeeId?: number,
    ): Promise<TaskCompletionResponse[]> {
        const completions = await this.repo.findByPeriod(period, employeeId);
        return completions.map((completion) =>
            this.mapper.toResponse(completion),
        );
    }
}
