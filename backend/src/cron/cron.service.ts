import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { BitrixSyncService } from '../sync/bitrix/bitrix.service';
import { ProdCron } from './utils';
import { RoappSyncService } from '../sync/roapp/roapp.service';
import { CustomApiRoappSyncService } from '../sync/custom-api-roapp/custom-api-roapp.service';
import { logCronError } from './cron-file-logger';

const MAX_CONSECUTIVE_FAILURES = 3;

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  private bitrixFailedSince: Date | null = null;
  private bitrixConsecutiveFailures = 0;

  private roappFailedSince: Date | null = null;
  private roappConsecutiveFailures = 0;

  constructor(
    private readonly Bitrix: BitrixSyncService,
    private readonly ROApp: RoappSyncService,
    private readonly CustomApiRoApp: CustomApiRoappSyncService,
  ) {}

  @ProdCron(CronExpression.EVERY_5_MINUTES)
  async getUpdatesDeals() {
    await this.syncBitrixDeals();
    await this.syncRoappOrders();
  }

  private async syncBitrixDeals() {
    const since =
      this.bitrixFailedSince ?? new Date(Date.now() - 60 * 5 * 1000);

    try {
      await this.Bitrix.uploadModifiedDeals(since);
      this.logger.log('Successfully fetched updated deals from Bitrix24');
      this.bitrixFailedSince = null;
      this.bitrixConsecutiveFailures = 0;
    } catch (error) {
      if (!this.bitrixFailedSince) {
        this.bitrixFailedSince = since;
      }
      this.bitrixConsecutiveFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch updated deals from Bitrix24 (попытка ${this.bitrixConsecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${message}. Will retry next tick from ${this.bitrixFailedSince.toISOString()}`,
      );
      logCronError('getUpdatesDeals:bitrix', error, {
        since: since.toISOString(),
      });

      if (this.bitrixConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await this.reloadBitrixReferenceData();
      }
    }
  }

  private async syncRoappOrders() {
    const since = this.roappFailedSince ?? new Date(Date.now() - 60 * 5 * 1000);

    try {
      const ordersIds = await this.ROApp.uploadUpdatedOrders(since);
      await this.ROApp.uploadOrderItems(ordersIds);
      this.logger.log('Successfully fetched updated deals from ROApp');
      this.roappFailedSince = null;
      this.roappConsecutiveFailures = 0;
    } catch (error) {
      if (!this.roappFailedSince) {
        this.roappFailedSince = since;
      }
      this.roappConsecutiveFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to fetch updated deals from ROApp (попытка ${this.roappConsecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${message}. Will retry next tick from ${this.roappFailedSince.toISOString()}`,
      );
      logCronError('getUpdatesDeals:roapp', error, {
        since: since.toISOString(),
      });

      if (this.roappConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await this.reloadRoappReferenceData();
      }
    }
  }

  private async reloadBitrixReferenceData() {
    this.logger.warn(
      `${MAX_CONSECUTIVE_FAILURES} ошибки подряд при синхронизации Bitrix24 — перезагружаю справочники`,
    );
    try {
      await this.Bitrix.uploadEmployees();
      await this.Bitrix.uploadStages();
      await this.Bitrix.uploadDeviceTypes();
      await this.Bitrix.uploadLeadSources();
      await this.Bitrix.uploadEnums();
      await this.Bitrix.uploadSources();
      this.logger.log('Справочники Bitrix24 успешно перезагружены');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Не удалось перезагрузить справочники Bitrix24: ${message}`,
      );
      logCronError('reloadBitrixReferenceData', error);
    } finally {
      // Сбрасываем счётчик в любом случае, чтобы не перезагружать справочники на каждом тике,
      // если проблема не в них — следующая перезагрузка произойдёт снова после 3 ошибок подряд.
      this.bitrixConsecutiveFailures = 0;
    }
  }

  private async reloadRoappReferenceData() {
    this.logger.warn(
      `${MAX_CONSECUTIVE_FAILURES} ошибки подряд при синхронизации ROApp — перезагружаю справочники`,
    );
    try {
      await this.ROApp.uploadEmployees();
      await this.ROApp.uploadMarketingSources();
      await this.ROApp.uploadOrderStatuses();
      await this.ROApp.uploadOrderTypes();
      await this.ROApp.uploadProductCategories();
      await this.ROApp.uploadServiceCategories();
      await this.ROApp.uploadServices();
      await this.ROApp.uploadProducts();
      await this.CustomApiRoApp.uploadServicesBonuses();
      this.logger.log('Справочники ROApp успешно перезагружены');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Не удалось перезагрузить справочники ROApp: ${message}`,
      );
      logCronError('reloadRoappReferenceData', error);
    } finally {
      this.roappConsecutiveFailures = 0;
    }
  }
}
