import { Controller, Get, Query } from '@nestjs/common';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { TaskCompletionListQueryDto } from '../dto/task-completion-list-query.dto';
import { ListTaskCompletionsService } from '../../application/services/list-task-completions.service';

@Controller('accounting')
export class ListTaskCompletionsHttpController {
    constructor(
        private readonly listTaskCompletions: ListTaskCompletionsService,
    ) {}

    @Get('task_completions')
    async list(
        @Query() query: TaskCompletionListQueryDto,
    ): Promise<TaskCompletionResponse[]> {
        return this.listTaskCompletions.execute(query.period, query.employeeId);
    }
}
