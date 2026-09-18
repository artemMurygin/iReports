import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskLink } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ListTaskLinksService } from '@/modules/tasks/application/services/list-task-links.service';

// spec: tasks/links#Requirement: Задача может иметь несколько ссылок
@ApiTags('Задачи: ссылки')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('tasks:view')
@Controller()
export class ListTaskLinksHttpController {
    constructor(private readonly listTaskLinks: ListTaskLinksService) {}

    @Get(routesV1.tasks.links)
    @ApiOperation({ summary: 'Список ссылок задачи' })
    async list(@Param('id') id: string): Promise<TaskLink[]> {
        return this.listTaskLinks.execute(id);
    }
}
