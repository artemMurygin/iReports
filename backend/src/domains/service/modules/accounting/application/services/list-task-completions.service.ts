import { Inject, Injectable } from '@nestjs/common';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import type { TaskCompletionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { toTaskCompletionResponse } from '@/domains/service/modules/accounting/application/mappers/to-task-completion-response';

@Injectable()
export class ListTaskCompletionsService {
    constructor(
        @Inject(TASK_COMPLETION_REPOSITORY)
        private readonly repo: TaskCompletionRepositoryPort,
    ) {}

    async execute(
        period: string,
        employeeId?: number,
    ): Promise<TaskCompletionResponse[]> {
        const completions = await this.repo.findByPeriod(period, employeeId);
        return completions.map(toTaskCompletionResponse);
    }
}
