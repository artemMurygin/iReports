import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { logCronError } from '../../../../shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { MoySkladSyncService } from './moysklad-sync.service';

// spec: shop-turnover-report D5/D9 — почасовой снимок остатков в
// MoySkladStock, независимая крон-задача от MoySkladSyncCron (5-минутный
// синк справочников/Demand, см. moysklad-sync.cron.ts) — design.md прямо
// указывает, что синк остатков и пересчёт отчёта не обязаны быть "приклеены"
// к одному тику: важно только, чтобы самый свежий снимок не был старше часа.
@Injectable()
export class MoySkladStockSyncCron {
    private readonly logger = new Logger(MoySkladStockSyncCron.name);

    constructor(private readonly syncService: MoySkladSyncService) {}

    @ProdCron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        try {
            await runInSystemRequestContext(() =>
                this.syncService.uploadStockSnapshot(),
            );
            this.logger.log('Successfully synced stock snapshot from MoySklad');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to sync stock snapshot: ${message}`);
            logCronError('MoySkladStockSyncCron.run', error);
        }
    }
}
