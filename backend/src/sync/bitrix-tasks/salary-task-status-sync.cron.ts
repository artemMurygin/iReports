import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { SalaryTaskStatusSyncService } from './salary-task-status-sync.service';

// Раздел 8 tasks.md (add-task-based-salary-rule), design.md Decision 3 — по
// образцу SalesPlanAutoCreationCron (`domains/service/modules/sales/
// infrastructure/cron/sales-plan-auto-creation.cron.ts`): крон выполняется
// вне HTTP-запроса, поэтому оборачивает вызов в runInSystemRequestContext
// (без него DatabaseService/домен читают ещё не открытый RequestContext).
//
// @ProdCron реально тикает только в проде (см. prod-cron.decorator.ts).
@Injectable()
export class SalaryTaskStatusSyncCron {
    private readonly logger = new Logger(SalaryTaskStatusSyncCron.name);

    constructor(private readonly syncService: SalaryTaskStatusSyncService) {}

    @ProdCron(CronExpression.EVERY_5_MINUTES)
    async run(): Promise<void> {
        try {
            await runInSystemRequestContext(() => this.syncService.run());
            this.logger.log('Synced salary task statuses from Bitrix24');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to sync salary task statuses: ${message}`,
            );
            logCronError('SalaryTaskStatusSyncCron.run', error);
        }
    }
}
