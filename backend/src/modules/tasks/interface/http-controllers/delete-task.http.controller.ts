import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { DeleteTaskCommand } from '@/modules/tasks/application/command/delete-task/delete-task.command';

@ApiTags('Задачи')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('tasks:delete')
@Controller()
export class DeleteTaskHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.tasks.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удалить задачу целиком, вместе с её комментариями и ссылками (несуществующая задача — 404). Безвозвратно, без soft-delete',
    })
    async delete(@Param('id') id: string): Promise<void> {
        await this.commandBus.execute(new DeleteTaskCommand({ taskId: id }));
    }
}
