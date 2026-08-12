import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { TaskCompletionConfirmDto } from '../dto/task-completion-confirm.dto';
import { TaskCompletionRejectDto } from '../dto/task-completion-reject.dto';
import { ConfirmTaskCompletionCommand } from '../../application/command/confirm-task-completion.command';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class ConfirmTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.confirmTaskCompletion)
    @ApiOperation({ summary: 'Подтвердить выполнение задачи сотрудником' })
    async confirm(
        @Param('id') id: string,
        @Body() body: TaskCompletionConfirmDto,
    ): Promise<TaskCompletionResponse> {
        const command = new ConfirmTaskCompletionCommand({
            taskCompletionId: id,
            confirmedBy: body.confirmedBy,
            approve: true,
        });
        return this.commandBus.execute(command);
    }

    @Post(routesV1.service.accounting.rejectTaskCompletion)
    @ApiOperation({ summary: 'Отклонить выполнение задачи сотрудником' })
    async reject(
        @Param('id') id: string,
        @Body() body: TaskCompletionRejectDto,
    ): Promise<TaskCompletionResponse> {
        const command = new ConfirmTaskCompletionCommand({
            taskCompletionId: id,
            confirmedBy: body.confirmedBy,
            approve: false,
        });
        return this.commandBus.execute(command);
    }
}
