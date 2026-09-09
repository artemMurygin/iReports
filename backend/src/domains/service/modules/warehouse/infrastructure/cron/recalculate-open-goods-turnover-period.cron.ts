import { Inject, Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { GOODS_TURNOVER_REPORT_LINE_REPOSITORY } from '../../application/ports/goods-turnover-report/goods-turnover-report-line.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '../../application/ports/goods-turnover-report/goods-turnover-report-line.port';
import { BuildGoodsTurnoverReportService } from '../../application/services/build-goods-turnover-report.service';

// Почасовой пересчёт отчёта по оборачиваемости за текущий месяц (design.md
// D6), пока зарплатный AccountingPeriod('service', period) этого месяца не
// закрыт — как только он закрыт, финальный снэпшот уже зафиксирован
// обработчиком CloseGoodsTurnoverPeriod (задача 12), крон больше не трогает
// этот период до следующего открытого месяца. Только direction='service' —
// у отчёта нет собственного статуса периода (design.md D5), статус целиком
// определяется зарплатным AccountingPeriod.
//
// @ProdCron реально тикает только в проде (см. prod-cron.decorator.ts).
// Крон выполняется вне HTTP-запроса, поэтому оборачивается в
// runInSystemRequestContext — по аналогии с SalesPlanAutoCreationCron.
@Injectable()
export class RecalculateOpenGoodsTurnoverPeriodCron {
    private readonly logger = new Logger(
        RecalculateOpenGoodsTurnoverPeriodCron.name,
    );

    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly accountingPeriodRepository: AccountingPeriodRepositoryPort,
        private readonly buildReport: BuildGoodsTurnoverReportService,
        @Inject(GOODS_TURNOVER_REPORT_LINE_REPOSITORY)
        private readonly lineRepository: GoodsTurnoverReportLineRepositoryPort,
    ) {}

    @ProdCron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        // Тот же UTC-расчёт "текущего периода", что и у
        // SalesPlanAutoCreationCron/Period.getBounds().
        const period = Period.current().getValue();

        try {
            await runInSystemRequestContext(() => this.recalculate(period));
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Не удалось пересчитать оборачиваемость за ${period}: ${message}`,
            );
            logCronError('RecalculateOpenGoodsTurnoverPeriodCron.run', error, {
                period,
            });
        }
    }

    private async recalculate(period: string): Promise<void> {
        const accountingPeriod =
            await this.accountingPeriodRepository.findByDirectionAndPeriod(
                'service',
                period,
            );

        // Нет записи трактуется как OPEN (см.
        // AccountingPeriodRepositoryPort, шапка комментария) — пересчитываем;
        // CLOSED — период уже зафиксирован финальным пересчётом при закрытии
        // (design.md D7), почасовой крон его больше не трогает.
        if (accountingPeriod?.isClosed()) {
            this.logger.log(
                `Период ${period} закрыт — почасовой пересчёт оборачиваемости пропущен`,
            );
            return;
        }

        // Сбой отдельной пары категория-склад уже обработан внутри
        // BuildGoodsTurnoverReportService (design.md D6, "частичный успех
        // лучше, чем полный сбой") — build() возвращает отчёт с
        // оставшимися строками и не бросает исключение из-за одной пары.
        const report = await this.buildReport.build(period);
        await this.lineRepository.replaceAll(period, report.lines);
        this.logger.log(
            `Оборачиваемость за ${period} пересчитана: ${report.lines.length} строк`,
        );
    }
}
