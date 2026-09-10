import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateTaskHandler } from './application/command/create-task/create-task.handler';
import { ChangeTaskStatusHandler } from './application/command/change-task-status/change-task-status.handler';
import { AddTaskCommentHandler } from './application/command/add-task-comment/add-task-comment.handler';
import { AddTaskLinkHandler } from './application/command/add-task-link/add-task-link.handler';
import { RemoveTaskLinkHandler } from './application/command/remove-task-link/remove-task-link.handler';
import { CancelTaskForRuleDeletionService } from './application/services/cancel-task-for-rule-deletion.service';
import { ListTasksService } from './application/services/list-tasks.service';
import { GetTaskService } from './application/services/get-task.service';
import { ListTaskCommentsService } from './application/services/list-task-comments.service';
import { ListTaskLinksService } from './application/services/list-task-links.service';
import { TASK_REPOSITORY } from './application/ports/task.repository.port';
import { TASK_COMMENT_REPOSITORY } from './application/ports/task-comment.repository.port';
import { TASK_LINK_REPOSITORY } from './application/ports/task-link.repository.port';
import { TaskRepository } from './infrastructure/repositories/task.repository';
import { TaskCommentRepository } from './infrastructure/repositories/task-comment.repository';
import { TaskLinkRepository } from './infrastructure/repositories/task-link.repository';
import { CreateTaskHttpController } from './interface/http-controllers/create-task.http.controller';
import { ListTasksHttpController } from './interface/http-controllers/list-tasks.http.controller';
import { GetTaskHttpController } from './interface/http-controllers/get-task.http.controller';
import { ChangeTaskStatusHttpController } from './interface/http-controllers/change-task-status.http.controller';
import { ListTaskCommentsHttpController } from './interface/http-controllers/list-task-comments.http.controller';
import { CreateTaskCommentHttpController } from './interface/http-controllers/create-task-comment.http.controller';
import { ListTaskLinksHttpController } from './interface/http-controllers/list-task-links.http.controller';
import { CreateTaskLinkHttpController } from './interface/http-controllers/create-task-link.http.controller';
import { DeleteTaskLinkHttpController } from './interface/http-controllers/delete-task-link.http.controller';

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
        ListTaskCommentsHttpController,
        CreateTaskCommentHttpController,
        ListTaskLinksHttpController,
        CreateTaskLinkHttpController,
        DeleteTaskLinkHttpController,
    ],
    providers: [
        CreateTaskHandler,
        ChangeTaskStatusHandler,
        AddTaskCommentHandler,
        AddTaskLinkHandler,
        RemoveTaskLinkHandler,
        CancelTaskForRuleDeletionService,
        ListTasksService,
        GetTaskService,
        ListTaskCommentsService,
        ListTaskLinksService,
        {
            provide: TASK_REPOSITORY,
            useClass: TaskRepository,
        },
        {
            provide: TASK_COMMENT_REPOSITORY,
            useClass: TaskCommentRepository,
        },
        {
            provide: TASK_LINK_REPOSITORY,
            useClass: TaskLinkRepository,
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
