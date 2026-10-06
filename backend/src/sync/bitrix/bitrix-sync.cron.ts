import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../shared/cron/prod-cron.decorator';
import { toError } from '@/shared/logger/to-error';
import { BitrixSyncService } from './bitrix-sync.service';

@Injectable()
export class BitrixSyncCron {
    private readonly logger = new Logger(BitrixSyncCron.name);
    private failedSince: Date | null = null;

    constructor(private readonly syncService: BitrixSyncService) {}

    @ProdCron(CronExpression.EVERY_5_MINUTES)
    async run() {
        const startedAt = Date.now();
        const since = this.failedSince ?? new Date(startedAt - 60 * 5 * 1000);

        try {
            await this.syncService.uploadModifiedDeals(since);
            this.logger.log(
                { durationMs: Date.now() - startedAt },
                'Successfully synced updated deals from Bitrix24',
            );
            this.failedSince = null;
        } catch (error) {
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
                'Failed to sync updated deals, will retry next tick',
            );
        }
    }
}
