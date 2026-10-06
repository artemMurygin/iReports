import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { toError } from '@/shared/logger/to-error';
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

    // spec: shop/moysklad-sync#requirement-синхронизации-одного-направления-не-выполняются-параллельно
    @ProdCron(CronExpression.EVERY_5_MINUTES)
    async run() {
        const startedAt = Date.now();
        const since = this.failedSince ?? new Date(startedAt - 60 * 5 * 1000);

        try {
            // uploadStores() перед демандами: MoySkladDemand.storeId — реальный
            // FK на MoySkladStore (см. moySklad.prisma, D3
            // shop-turnover-report) — апсерт демандов упадёт, если склад ещё
            // не засинкан.
            await this.lock.runExclusive('shop', async () => {
                await this.syncService.uploadStores();
                await this.syncService.uploadUpdatedDemands(since);
            });
            this.logger.log(
                { durationMs: Date.now() - startedAt },
                'Successfully synced stores and updated demands from MoySklad',
            );
            this.failedSince = null;
        } catch (error) {
            // spec: shop/moysklad-sync#requirement-сбой-регулярной-синхронизации-не-теряет-и-не-сдвигает-точку-докатки
            if (!this.failedSince) {
                this.failedSince = since;
            }
            this.logger.error(
                {
                    err: toError(error),
                    since: since.toISOString(),
                    retryFrom: this.failedSince.toISOString(),
                    durationMs: Date.now() - startedAt,
                },
                'Failed to sync updated demands, will retry next tick',
            );
        }
    }
}
