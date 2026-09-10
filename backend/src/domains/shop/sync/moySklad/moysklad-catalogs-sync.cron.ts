import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../../../shared/cron/cron-file-logger';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';
import { MoySkladSyncService } from './moysklad-sync.service';

// Почасовая синхронизация справочников МойСклад (сотрудники, папки/категории
// товаров, товары, услуги, склады), отдельно от MoySkladSyncCron (склады +
// отгрузки каждые 5 минут) и MoySkladStockSyncCron (снимок остатков).
// Выполняется под той же DirectionSyncLock('shop'), что и регулярный синк
// отгрузок, чтобы избежать параллельной записи в БД направления.
@Injectable()
export class MoySkladCatalogsSyncCron {
    private readonly logger = new Logger(MoySkladCatalogsSyncCron.name);

    constructor(
        private readonly syncService: MoySkladSyncService,
        private readonly lock: DirectionSyncLock,
    ) {}

    @ProdCron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        try {
            await this.lock.runExclusive('shop', async () => {
                await this.syncService.uploadEmployees();
                await this.syncService.uploadProductFolders();
                await this.syncService.uploadProducts();
                await this.syncService.uploadServices();
                await this.syncService.uploadStores();
            });
            this.logger.log('Successfully synced MoySklad catalogs');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to sync MoySklad catalogs: ${message}`);
            logCronError('MoySkladCatalogsSyncCron.run', error);
        }
    }
}
