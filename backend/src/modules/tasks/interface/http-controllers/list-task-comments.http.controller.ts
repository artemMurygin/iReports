import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskComment } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ListTaskCommentsService } from '@/modules/tasks/application/services/list-task-comments.service';

// spec: tasks/comments#Requirement: Комментарии видны каждому, кто открывает
// карточку задачи
@ApiTags('Задачи: комментарии')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('tasks:view')
@Controller()
export class ListTaskCommentsHttpController {
    constructor(private readonly listTaskComments: ListTaskCommentsService) {}

    @Get(routesV1.tasks.comments)
    @ApiOperation({
        summary:
            'Список комментариев задачи в хронологическом порядке (от старого к новому)',
    })
    async list(@Param('id') id: string): Promise<TaskComment[]> {
        return this.listTaskComments.execute(id);
    }
}
