import { Inject, Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../../../shared/cron/cron-file-logger';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';
import { RoappSyncService } from './roapp-sync.service';

@Injectable()
export class RoappSyncCron {
    private readonly logger = new Logger(RoappSyncCron.name);
    private failedSince: Date | null = null;

    constructor(
        private readonly syncService: RoappSyncService,
        @Inject(DOMAIN_SYNC_STATUS)
        private readonly domainSyncStatus: DomainSyncStatusPort,
        private readonly lock: DirectionSyncLock,
    ) {}

    // Тик идёт под блокировкой направления (DirectionSyncLock, см.
    // RoappErpPeriodSyncAdapter — PRD 1 docs/payroll-closing-and-accrual).
    // spec: service/roapp-sync#scenario-точечная-синхронизация-ждёт-завершения-идущей-регулярной
    @ProdCron(CronExpression.EVERY_5_MINUTES)
    async run() {
        const since = this.failedSince ?? new Date(Date.now() - 60 * 5 * 1000);

        try {
            await this.lock.runExclusive('service', async () => {
                const orderIds =
                    await this.syncService.uploadUpdatedOrders(since);
                await this.syncService.uploadOrderItems(orderIds);
            });
            this.logger.log('Successfully synced updated orders from Roapp');
            this.failedSince = null;
            // Штамп для ленивого кэша расчёта зарплаты (Фаза 6, см.
            // docs/payroll/plan-payroll-calculation.md). DomainSyncStatusRepository
            // пишет напрямую через DatabaseService (не через
            // PrismaRepository/RequestContext), поэтому вызов безопасен и
            // вне HTTP-запроса, в котором выполняется крон.
            // spec: service/roapp-sync#scenario-успешный-регулярный-запуск-фиксирует-отметку-актуальности
            await this.domainSyncStatus.markSuccessful('service');
        } catch (error) {
            if (!this.failedSince) {
                this.failedSince = since;
            }
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to sync updated orders: ${message}. Will retry next tick from ${this.failedSince.toISOString()}`,
            );
            logCronError('RoappSyncCron.run', error, {
                since: since.toISOString(),
            });
        }
    }
}
