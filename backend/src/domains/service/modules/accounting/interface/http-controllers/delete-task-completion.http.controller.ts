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
import { DeleteTaskCompletionCommand } from '../../application/command/delete-task-completion.command';

@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class DeleteTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.service.accounting.taskCompletionById)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить запись о выполнении задачи' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteTaskCompletionCommand({
            taskCompletionId: id,
        });
        await this.commandBus.execute(command);
    }
}
