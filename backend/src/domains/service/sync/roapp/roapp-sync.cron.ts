import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../../../shared/cron/cron-file-logger';
import { RoappSyncService } from './roapp-sync.service';

@Injectable()
export class RoappSyncCron {
  private readonly logger = new Logger(RoappSyncCron.name);
  private failedSince: Date | null = null;

  constructor(private readonly syncService: RoappSyncService) {}

  @ProdCron(CronExpression.EVERY_5_MINUTES)
  async run() {
    const since = this.failedSince ?? new Date(Date.now() - 60 * 5 * 1000);

    try {
      const orderIds = await this.syncService.uploadUpdatedOrders(since);
      await this.syncService.uploadOrderItems(orderIds);
      this.logger.log('Successfully synced updated orders from Roapp');
      this.failedSince = null;
    } catch (error) {
      if (!this.failedSince) {
        this.failedSince = since;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to sync updated orders: ${message}. Will retry next tick from ${this.failedSince.toISOString()}`,
      );
      logCronError('RoappSyncCron.run', error, { since: since.toISOString() });
    }
  }
}
