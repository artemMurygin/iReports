import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { TaskCompletionCreateDto } from '../dto/task-completion-create.dto';
import { CreateTaskCompletionCommand } from '../../application/command/create-task-completion.command';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class CreateTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.taskCompletions)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Отметить задачу сотрудника выполненной' })
    async create(
        @Body() body: TaskCompletionCreateDto,
    ): Promise<TaskCompletionResponse> {
        const command = new CreateTaskCompletionCommand(body);
        return this.commandBus.execute(command);
    }
}
