import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../../../shared/cron/cron-file-logger';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';
import { RoappSyncService } from './roapp-sync.service';

// Почасовая синхронизация справочников RemOnline (сотрудники, склады,
// статусы/типы заказов, источники, категории и номенклатура), отдельно от
// RoappSyncCron — тот синкает только сами заказы и позиции каждые 5 минут.
// Выполняется под той же DirectionSyncLock('service'), что и регулярный
// синк заказов, чтобы избежать параллельной записи в БД направления.
@Injectable()
export class RoappCatalogsSyncCron {
    private readonly logger = new Logger(RoappCatalogsSyncCron.name);

    constructor(
        private readonly syncService: RoappSyncService,
        private readonly lock: DirectionSyncLock,
    ) {}

    @ProdCron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        try {
            await this.lock.runExclusive('service', async () => {
                await this.syncService.uploadEmployees();
                await this.syncService.uploadWarehouses();
                await this.syncService.uploadOrderStatuses();
                await this.syncService.uploadOrderTypes();
                await this.syncService.uploadMarketingSources();
                await this.syncService.uploadServiceCategories();
                await this.syncService.uploadProductCategories();
                await this.syncService.uploadServices();
                await this.syncService.uploadProducts();
                await this.syncService.uploadServiceBonuses();
            });
            this.logger.log('Successfully synced RemOnline catalogs');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to sync RemOnline catalogs: ${message}`);
            logCronError('RoappCatalogsSyncCron.run', error);
        }
    }
}
