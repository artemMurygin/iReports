import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { BitrixSyncService } from '../sync/bitrix/bitrix.service';
import { ProdCron } from './utils';
import { RoappSyncService } from '../sync/roapp/roapp.service';
import { MoySkladSyncService } from '../sync/moySklad/moySklad.service';
import { logCronError } from './cron-file-logger';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private failedSince: Date | null = null;
  private msFailedSince: Date | null = null;

  constructor(
    private readonly Bitrix: BitrixSyncService,
    private readonly ROApp: RoappSyncService,
    private readonly MoySklad: MoySkladSyncService,
  ) {}

  @ProdCron(CronExpression.EVERY_5_MINUTES)
  async getUpdatesDeals() {
    const since = this.failedSince ?? new Date(Date.now() - 60 * 5 * 1000);

    try {
      await this.Bitrix.uploadModifiedDeals(since);
      this.logger.log('Successfully fetched updated deals from Bitrix24');
      const ordersIds = await this.ROApp.uploadUpdatedOrders(since);
      await this.ROApp.uploadOrderItems(ordersIds);
      this.logger.log('Successfully fetched updated deals from ROApp');
      this.failedSince = null;
    } catch (error) {
      if (!this.failedSince) {
        this.failedSince = since;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch updated deals: ${message}. Will retry next tick from ${this.failedSince.toISOString()}`,
      );
      logCronError('getUpdatesDeals', error, { since: since.toISOString() });
    }
  }

  @ProdCron(CronExpression.EVERY_5_MINUTES)
  async getMoySkladUpdates() {
    const since = this.msFailedSince ?? new Date(Date.now() - 60 * 5 * 1000);

    try {
      await this.MoySklad.uploadDemands(since);
      this.logger.log('Successfully fetched updated demands from MoySklad');
      this.msFailedSince = null;
    } catch (error) {
      if (!this.msFailedSince) {
        this.msFailedSince = since;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch updated demands from MoySklad: ${message}. Will retry next tick from ${this.msFailedSince.toISOString()}`,
      );
      logCronError('getMoySkladUpdates', error, { since: since.toISOString() });
    }
  }
}
