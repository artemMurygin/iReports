import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Task } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListTasksService } from '@/modules/tasks/application/services/list-tasks.service';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';

@ApiTags('Задачи')
@Controller()
export class ListTasksHttpController {
    constructor(private readonly listTasks: ListTasksService) {}

    // specs/tasks/spec.md, Requirement: «Задача видна в интерфейсе на
    // любой стадии жизненного цикла» — список независим от зарплатного
    // отчёта, фильтры по status/direction необязательны (ui-design.md,
    // pages/Tasks, фрейм iZrrX).
    @Get(routesV1.tasks.root)
    @ApiOperation({
        summary:
            'Список задач с необязательным фильтром по статусу/направлению',
    })
    async list(@Query() query: ListTasksQueryDto): Promise<Task[]> {
        return this.listTasks.execute({
            status: query.status,
            direction: query.direction,
        });
    }
}
