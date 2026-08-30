import { Inject, Injectable } from '@nestjs/common';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import type { TaskCompletionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { TaskCompletionMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/task-completion/task-completion.mapper';

@Injectable()
export class ListTaskCompletionsService {
    private readonly mapper = new TaskCompletionMapper();

    constructor(
        @Inject(TASK_COMPLETION_REPOSITORY)
        private readonly repo: TaskCompletionRepositoryPort,
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
