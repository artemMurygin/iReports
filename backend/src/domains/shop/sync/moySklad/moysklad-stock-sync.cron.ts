import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '../../../../shared/cron/prod-cron.decorator';
import { toError } from '@/shared/logger/to-error';
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
        const startedAt = Date.now();
        try {
            await runInSystemRequestContext(() =>
                this.syncService.uploadStockSnapshot(),
            );
            this.logger.log(
                { durationMs: Date.now() - startedAt },
                'Successfully synced stock snapshot from MoySklad',
            );
        } catch (error) {
            this.logger.error(
                { err: toError(error), durationMs: Date.now() - startedAt },
                'Failed to sync stock snapshot',
            );
        }
    }
}
