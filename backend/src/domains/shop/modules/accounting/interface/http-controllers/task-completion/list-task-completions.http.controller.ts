import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopTaskCompletionListQueryDto } from '../../dto/task-completion/task-completion-list-query.dto';
import { ListShopTaskCompletionsService } from '../../../application/services/task-completion/list-task-completions.service';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class ListShopTaskCompletionsHttpController {
    constructor(
        private readonly listShopTaskCompletions: ListShopTaskCompletionsService,
    ) {}

    @Get(routesV1.shop.accounting.taskCompletions)
    @ApiOperation({ summary: 'Записи о выполнении задач магазина за период' })
    async list(
        @Query() query: ShopTaskCompletionListQueryDto,
    ): Promise<TaskCompletionResponse[]> {
        return this.listShopTaskCompletions.execute(
            query.period,
            query.employeeId,
        );
    }
}
