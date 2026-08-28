import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import { EnsureShopSalesPlansForPeriodService } from '@/domains/shop/modules/sales/application/services/ensure-shop-sales-plans-for-period.service';

// Собственный экземпляр крона для направления shop (Фаза 11), поверх
// собственного EnsureShopSalesPlansForPeriodService (Фаза 7
// docs/service-shop-boundary-violations-fix, независимая копия одноимённого
// сервиса направления service — не переиспользуется между доменами).
//
// @ProdCron реально тикает только в проде (см. prod-cron.decorator.ts) —
// в dev-среде и после простоя план достраивается лениво при первом
// обращении к периоду (см. GetShopSalesPerformanceService), поэтому этот
// крон не единственный путь создания строк, а лишь заблаговременный.
@Injectable()
export class ShopSalesPlanAutoCreationCron {
    private readonly logger = new Logger(ShopSalesPlanAutoCreationCron.name);

    constructor(
        private readonly ensureSalesPlans: EnsureShopSalesPlansForPeriodService,
    ) {}

    @ProdCron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async run(): Promise<void> {
        // Тот же UTC-расчёт "текущего периода", что и у крона направления
        // service — иначе план и факт разъедутся на сутки.
        const period = Period.current().getValue();

        try {
            await runInSystemRequestContext(() =>
                this.ensureSalesPlans.ensure(period),
            );
            this.logger.log(`Shop sales plans ensured for period ${period}`);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to auto-create shop sales plans for ${period}: ${message}`,
            );
            logCronError('ShopSalesPlanAutoCreationCron.run', error, {
                period,
            });
        }
    }
}
