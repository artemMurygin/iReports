import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DealsService } from '../deals/deals.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private failedSince: Date | null = null;

  constructor(private readonly DealsService: DealsService) {}

  // @Cron(CronExpression.EVERY_5_MINUTES)
  // async getUpdatesFromBitrix() {
  //   const since = this.failedSince ?? new Date(Date.now() - 60 * 5 * 1000);
  //
  //   try {
  //     await this.DealsService.uploadModifiedDeals(since);
  //     this.logger.log('Successfully fetched updated deals from Bitrix24');
  //     this.failedSince = null;
  //   } catch (error) {
  //     if (!this.failedSince) {
  //       this.failedSince = since;
  //     }
  //     this.logger.error(
  //       `Failed to fetch updated deals from Bitrix24: ${error.message}. Will retry next tick from ${this.failedSince.toISOString()}`,
  //     );
  //   }
  // }
}
