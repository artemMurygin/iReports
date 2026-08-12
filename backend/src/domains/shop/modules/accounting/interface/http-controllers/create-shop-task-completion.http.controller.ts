import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskCompletionResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopTaskCompletionCreateDto } from '../dto/shop-task-completion-create.dto';
import { CreateShopTaskCompletionCommand } from '../../application/command/create-shop-task-completion.command';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class CreateShopTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.taskCompletions)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Отметить задачу сотрудника магазина выполненной',
    })
    async create(
        @Body() body: ShopTaskCompletionCreateDto,
    ): Promise<TaskCompletionResponse> {
        const command = new CreateShopTaskCompletionCommand(body);
        return this.commandBus.execute(command);
    }
}
