import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { toError } from '@/shared/logger/to-error';
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
        const startedAt = Date.now();
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
            this.logger.log(
                { durationMs: Date.now() - startedAt },
                'Successfully synced RemOnline catalogs',
            );
        } catch (error) {
            this.logger.error(
                { err: toError(error), durationMs: Date.now() - startedAt },
                'Failed to sync RemOnline catalogs',
            );
        }
    }
}
