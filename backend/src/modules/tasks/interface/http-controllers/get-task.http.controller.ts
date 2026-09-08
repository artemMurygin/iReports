import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Task } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetTaskService } from '@/modules/tasks/application/services/get-task.service';

@ApiTags('Задачи')
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
