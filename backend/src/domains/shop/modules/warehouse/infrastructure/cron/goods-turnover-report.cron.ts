import { Inject, Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { RebuildGoodsTurnoverReportService } from '@/domains/shop/modules/warehouse/application/services/goods-turnover-report/rebuild-goods-turnover-report.service';

// Почасовой пересчёт отчёта по оборачиваемости текущего (открытого) месяца
// (design.md D9) — независим от MoySkladStockSyncCron (синк остатков, см.
// sync/moySklad/moysklad-stock-sync.cron.ts): требование — "не реже раза в
// час", а не привязка к конкретному тику соседнего крона.
//
// ShopAccountingPeriodRepositoryPort.findByPeriod возвращает null для
// периода, ещё не имеющего записи — это трактуется как OPEN (см. WHY в
// самом порте/ShopAccountingPeriod), поэтому "период закрыт" — это именно
// `record !== null && record.isClosed()`, а не просто "записи нет".
@Injectable()
export class GoodsTurnoverReportCron {
    private readonly logger = new Logger(GoodsTurnoverReportCron.name);

    constructor(
        private readonly rebuildReport: RebuildGoodsTurnoverReportService,
        @Inject(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
        private readonly accountingPeriods: ShopAccountingPeriodRepositoryPort,
    ) {}

    @ProdCron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        const period = Period.current();

        try {
            await runInSystemRequestContext(async () => {
                const record = await this.accountingPeriods.findByPeriod(
                    period.getValue(),
                );
                if (record?.isClosed()) {
                    this.logger.log(
                        `Период ${period.getValue()} закрыт — пересчёт отчёта по оборачиваемости пропущен`,
                    );
                    return;
                }
                await this.rebuildReport.rebuild(period);
                this.logger.log(
                    `Отчёт по оборачиваемости пересчитан за период ${period.getValue()}`,
                );
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Не удалось пересчитать отчёт по оборачиваемости за ${period.getValue()}: ${message}`,
            );
            logCronError('GoodsTurnoverReportCron.run', error, {
                period: period.getValue(),
            });
        }
    }
}
