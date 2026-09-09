import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { BitrixService } from '@/integrations/bitrix/bitrix.service';
import { BITRIX_TASK_STATUS_COMPLETED } from '@/integrations/bitrix/schema';
import { logCronError } from '@/shared/cron/cron-file-logger';

/**
 * Раздел 8 tasks.md (add-task-based-salary-rule), design.md Decision 3:
 * поллинг статусов задач Bitrix24, связанных с зарплатными правилами
 * `TaskCompletion`, ОБОИХ направлений (`service`/`shop`) сразу.
 *
 * Живёт вне `domains/{service,shop}` (`src/sync/bitrix-tasks/`, по аналогии
 * с `src/sync/bitrix/`) и пишет статус НАПРЯМУЮ в общую таблицу
 * `salary_tasks` через `DatabaseService` (как
 * `BitrixSyncService.uploadModifiedDeals`), а не через доменные
 * `SalaryTaskRepository` каждого направления — обновление
 * `taskStatus`/`lastSyncedAt` не несёт доменной бизнес-логики (см.
 * `backend/CLAUDE.md`, «Общие таблицы», исключения `BalanceTransaction`/
 * `EmployeeDismissal`).
 */
@Injectable()
export class SalaryTaskStatusSyncService {
    private readonly logger = new Logger(SalaryTaskStatusSyncService.name);

    constructor(
        private readonly db: DatabaseService,
        private readonly bitrix: BitrixService,
    ) {}

    async run(): Promise<void> {
        // "Неактивная"/архивная задача, для которой опрос статуса больше не
        // нужен, — задача, УЖЕ известная как "Завершена" (STATUS = 5) на
        // момент последнего синка: закрытие задачи (BitrixService.closeTask,
        // design.md Decision 6) переводит её в тот же код, отдельного
        // "архивного" статуса Bitrix24 Tasks API не выделяет. Критерий
        // строится из уже сохранённого локально `taskStatus`, а не
        // повторным запросом к Bitrix24.
        const activeTasks = await this.db.salaryTask.findMany({
            where: {
                taskStatus: { not: String(BITRIX_TASK_STATUS_COMPLETED) },
            },
            select: { id: true, bitrixTaskId: true },
        });

        if (activeTasks.length === 0) {
            return;
        }

        let statuses: Map<string, string>;
        try {
            // ОДИН batch-вызов на весь список, не по одному на задачу
            // (design.md Decision 3).
            statuses = await this.bitrix.fetchTaskStatusesBatch(
                activeTasks.map((task) => task.bitrixTaskId),
            );
        } catch (error) {
            // Сетевая/HTTP-ошибка не должна ронять весь цикл синка — просто
            // логируем и оставляем lastSyncedAt как есть, следующий тик
            // (EVERY_5_MINUTES) повторит попытку для тех же задач.
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to fetch task statuses from Bitrix24: ${message}`,
            );
            logCronError('SalaryTaskStatusSyncService.run', error, {
                taskCount: activeTasks.length,
            });
            return;
        }

        const now = new Date();
        await Promise.all(
            activeTasks
                .filter((task) => statuses.has(task.bitrixTaskId))
                .map((task) =>
                    this.db.salaryTask.update({
                        where: { id: task.id },
                        data: {
                            taskStatus: statuses.get(task.bitrixTaskId)!,
                            lastSyncedAt: now,
                        },
                    }),
                ),
        );
    }
}
