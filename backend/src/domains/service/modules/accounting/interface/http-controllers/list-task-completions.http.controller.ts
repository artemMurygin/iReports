import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { TaskCompletionListQueryDto } from '../dto/task-completion-list-query.dto';
import { ListTaskCompletionsService } from '../../application/services/list-task-completions.service';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class ListTaskCompletionsHttpController {
    constructor(
        private readonly listTaskCompletions: ListTaskCompletionsService,
    ) {}

    @Get(routesV1.service.accounting.taskCompletions)
    @ApiOperation({ summary: 'Записи о выполнении задач за период' })
    async list(
        @Query() query: TaskCompletionListQueryDto,
    ): Promise<TaskCompletionResponse[]> {
        return this.listTaskCompletions.execute(query.period, query.employeeId);
    }
}
