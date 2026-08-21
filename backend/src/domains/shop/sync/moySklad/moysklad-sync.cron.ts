import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../../../shared/cron/cron-file-logger';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';
import { MoySkladSyncService } from './moysklad-sync.service';

@Injectable()
export class MoySkladSyncCron {
    private readonly logger = new Logger(MoySkladSyncCron.name);
    private failedSince: Date | null = null;

    constructor(
        private readonly syncService: MoySkladSyncService,
        private readonly lock: DirectionSyncLock,
    ) {}

    // Тик идёт под блокировкой направления (DirectionSyncLock) — не
    // параллельно с неявным синком месяца внутри закрытия периода (PRD 1
    // docs/payroll-closing-and-accrual, MoySkladErpPeriodSyncAdapter).
    @ProdCron(CronExpression.EVERY_5_MINUTES)
    async run() {
        const since = this.failedSince ?? new Date(Date.now() - 60 * 5 * 1000);

        try {
            await this.lock.runExclusive('shop', () =>
                this.syncService.uploadUpdatedDemands(since),
            );
            this.logger.log(
                'Successfully synced updated demands from MoySklad',
            );
            this.failedSince = null;
        } catch (error) {
            if (!this.failedSince) {
                this.failedSince = since;
            }
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to sync updated demands: ${message}. Will retry next tick from ${this.failedSince.toISOString()}`,
            );
            logCronError('MoySkladSyncCron.run', error, {
                since: since.toISOString(),
            });
        }
    }
}
