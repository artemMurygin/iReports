import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { routesV1 } from '@/config/app.routes';
import { DeleteShopTaskCompletionCommand } from '../../application/command/delete-shop-task-completion.command';

@Controller()
export class DeleteShopTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shopAccounting.taskCompletionById)
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteShopTaskCompletionCommand({
            taskCompletionId: id,
        });
        await this.commandBus.execute(command);
    }
}
