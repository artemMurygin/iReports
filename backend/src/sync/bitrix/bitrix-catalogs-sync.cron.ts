import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../shared/cron/cron-file-logger';
import { BitrixSyncService } from './bitrix-sync.service';

// Почасовая синхронизация справочников Bitrix24 (сотрудники, отделы,
// стадии сделок, источники и т.п.), отдельно от BitrixSyncCron — тот
// синкает только сами сделки каждые 5 минут.
@Injectable()
export class BitrixCatalogsSyncCron {
    private readonly logger = new Logger(BitrixCatalogsSyncCron.name);

    constructor(private readonly syncService: BitrixSyncService) {}

    @ProdCron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        try {
            await this.syncService.uploadDepartments();
            await this.syncService.uploadEmployees();
            await this.syncService.uploadStages();
            await this.syncService.uploadSources();
            await this.syncService.uploadDeviceTypes();
            await this.syncService.uploadLeadSources();
            await this.syncService.uploadEnums();
            this.logger.log('Successfully synced Bitrix24 catalogs');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to sync Bitrix24 catalogs: ${message}`);
            logCronError('BitrixCatalogsSyncCron.run', error);
        }
    }
}
