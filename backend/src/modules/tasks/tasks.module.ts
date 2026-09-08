import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateTaskHandler } from './application/command/create-task/create-task.handler';
import { ChangeTaskStatusHandler } from './application/command/change-task-status/change-task-status.handler';
import { CancelTaskForRuleDeletionService } from './application/services/cancel-task-for-rule-deletion.service';
import { ListTasksService } from './application/services/list-tasks.service';
import { GetTaskService } from './application/services/get-task.service';
import { TASK_REPOSITORY } from './application/ports/task.repository.port';
import { TaskRepository } from './infrastructure/repositories/task.repository';
import { CreateTaskHttpController } from './interface/http-controllers/create-task.http.controller';
import { ListTasksHttpController } from './interface/http-controllers/list-tasks.http.controller';
import { GetTaskHttpController } from './interface/http-controllers/get-task.http.controller';
import { ChangeTaskStatusHttpController } from './interface/http-controllers/change-task-status.http.controller';

// Сквозной модуль (design.md решение 1) — по прецеденту employee-balance
// (полноценный модуль со своим HTTP), НЕ по прецеденту SalaryTask (общая
// таблица + независимый порт/репозиторий на каждый домен): логика задачи
// идентична для service/shop, дублировать её незачем. domains/service и
// domains/shop импортируют этот модуль целиком и инжектят
// TASK_REPOSITORY/CommandBus — единообразно, без повторной регистрации
// TaskRepository под тем же токеном в каждом accounting-модуле (см. решение
// 1, "DI-провайдинг — стандартизируем, а не копируем непоследовательность
// employee-balance").
@Module({
    imports: [CqrsModule],
    controllers: [
        CreateTaskHttpController,
        ListTasksHttpController,
        GetTaskHttpController,
        ChangeTaskStatusHttpController,
    ],
    providers: [
        CreateTaskHandler,
        ChangeTaskStatusHandler,
        CancelTaskForRuleDeletionService,
        ListTasksService,
        GetTaskService,
        {
            provide: TASK_REPOSITORY,
            useClass: TaskRepository,
        },
    ],
    // TASK_REPOSITORY — для task-completion-statuses.builder.ts
    // (domains/{service,shop}/modules/accounting, напрямую, без Port/Adapter
    // — design.md решение 5). CancelTaskForRuleDeletionService — для
    // хендлера удаления/отмены TaskCompletion-правила в обоих доменах
    // (design.md решение 3, "Отмена при удалении правила").
    exports: [TASK_REPOSITORY, CancelTaskForRuleDeletionService],
})
export class TasksModule {}
