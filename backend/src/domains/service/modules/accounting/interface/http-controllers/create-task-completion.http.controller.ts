import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { TaskCompletionCreateDto } from '../dto/task-completion-create.dto';
import { CreateTaskCompletionCommand } from '../../application/command/create-task-completion.command';

@Controller('accounting')
export class CreateTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post('task_completions')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() body: TaskCompletionCreateDto,
    ): Promise<TaskCompletionResponse> {
        const command = new CreateTaskCompletionCommand(body);
        return this.commandBus.execute(command);
    }
}
