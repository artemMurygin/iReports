import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { TaskCompletionConfirmDto } from '../dto/task-completion-confirm.dto';
import { TaskCompletionRejectDto } from '../dto/task-completion-reject.dto';
import { ConfirmTaskCompletionCommand } from '../../application/command/confirm-task-completion.command';

@Controller('accounting')
export class ConfirmTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post('task_completions/:id/confirm')
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

    @Post('task_completions/:id/reject')
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
