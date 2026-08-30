import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteShopTaskCompletionCommand } from '../../../application/command/task-completion/delete-task-completion.command';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class DeleteShopTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shop.accounting.taskCompletionById)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить запись о выполнении задачи магазина' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteShopTaskCompletionCommand({
            taskCompletionId: id,
        });
        await this.commandBus.execute(command);
    }
}
