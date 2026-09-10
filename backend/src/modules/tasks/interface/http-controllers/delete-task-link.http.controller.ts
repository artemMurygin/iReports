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
import { RemoveTaskLinkCommand } from '@/modules/tasks/application/command/remove-task-link/remove-task-link.command';

// spec: tasks/links#Requirement: Ссылка удаляется из карточки задачи —
// чужая/несуществующая ссылка отклоняется RemoveTaskLinkHandler
// (TaskLinkNotFoundException → 404, см. domain-exception.filter.ts).
@ApiTags('Задачи: ссылки')
@Controller()
export class DeleteTaskLinkHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.tasks.linkById)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удалить ссылку задачи (чужая или несуществующая ссылка — 404)',
    })
    async delete(
        @Param('id') id: string,
        @Param('linkId') linkId: string,
    ): Promise<void> {
        await this.commandBus.execute(
            new RemoveTaskLinkCommand({ taskId: id, linkId }),
        );
    }
}
