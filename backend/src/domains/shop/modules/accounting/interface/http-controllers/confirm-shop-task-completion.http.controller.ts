import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopTaskCompletionConfirmDto } from '../dto/shop-task-completion-confirm.dto';
import { ShopTaskCompletionRejectDto } from '../dto/shop-task-completion-reject.dto';
import { ConfirmShopTaskCompletionCommand } from '../../application/command/confirm-shop-task-completion.command';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class ConfirmShopTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.confirmTaskCompletion)
    @ApiOperation({
        summary: 'Подтвердить выполнение задачи сотрудником магазина',
    })
    async confirm(
        @Param('id') id: string,
        @Body() body: ShopTaskCompletionConfirmDto,
    ): Promise<TaskCompletionResponse> {
        const command = new ConfirmShopTaskCompletionCommand({
            taskCompletionId: id,
            confirmedBy: body.confirmedBy,
            approve: true,
        });
        return this.commandBus.execute(command);
    }

    @Post(routesV1.shop.accounting.rejectTaskCompletion)
    @ApiOperation({
        summary: 'Отклонить выполнение задачи сотрудником магазина',
    })
    async reject(
        @Param('id') id: string,
        @Body() body: ShopTaskCompletionRejectDto,
    ): Promise<TaskCompletionResponse> {
        const command = new ConfirmShopTaskCompletionCommand({
            taskCompletionId: id,
            confirmedBy: body.confirmedBy,
            approve: false,
        });
        return this.commandBus.execute(command);
    }
}
