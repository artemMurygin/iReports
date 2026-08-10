import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../shared/cron/cron-file-logger';
import { BitrixSyncService } from './bitrix-sync.service';

@Injectable()
export class BitrixSyncCron {
    private readonly logger = new Logger(BitrixSyncCron.name);
    private failedSince: Date | null = null;

    constructor(private readonly syncService: BitrixSyncService) {}

    @ProdCron(CronExpression.EVERY_5_MINUTES)
    async run() {
        const since = this.failedSince ?? new Date(Date.now() - 60 * 5 * 1000);

        try {
            await this.syncService.uploadModifiedDeals(since);
            this.logger.log('Successfully synced updated deals from Bitrix24');
            this.failedSince = null;
        } catch (error) {
            if (!this.failedSince) {
                this.failedSince = since;
            }
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to sync updated deals: ${message}. Will retry next tick from ${this.failedSince.toISOString()}`,
            );
            logCronError('BitrixSyncCron.run', error, {
                since: since.toISOString(),
            });
        }
    }
}
