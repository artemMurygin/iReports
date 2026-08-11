import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteTaskCompletionCommand } from '../../application/command/delete-task-completion.command';

@Controller('accounting')
export class DeleteTaskCompletionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete('task_completions/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteTaskCompletionCommand({
            taskCompletionId: id,
        });
        await this.commandBus.execute(command);
    }
}
