import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Task } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { GetTaskService } from '@/modules/tasks/application/services/get-task.service';

@ApiTags('Задачи')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('tasks:view')
@Controller()
export class GetTaskHttpController {
    constructor(private readonly getTask: GetTaskService) {}

    // specs/tasks/spec.md, Requirement: «Задача видна в интерфейсе на
    // любой стадии жизненного цикла» — карточка задачи (переиспользуется и
    // страницей /tasks, и SalaryRuleDetail — TaskStatusControl).
    @Get(routesV1.tasks.byId)
    @ApiOperation({ summary: 'Карточка задачи по id' })
    async get(@Param('id') id: string): Promise<Task> {
        return this.getTask.execute(id);
    }
}
