import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import { EnsureSalesPlansForPeriodService } from '../../application/services/ensure-sales-plans-for-period.service';

// Первого числа месяца план на новый период не пустой — руководителю не
// нужно заводить его заново (Фаза 4, docs/payroll/plan-payroll-calculation.md).
// Только направление service: у модуля sales домена shop (Фаза 11) будет
// собственный экземпляр этого крона поверх той же
// EnsureSalesPlansForPeriodService, а не общий с этим.
//
// @ProdCron реально тикает только в проде (см. prod-cron.decorator.ts) —
// в dev-среде и после простоя план достраивается лениво при первом
// обращении к периоду (см. ListSalesPlansService), поэтому этот крон не
// единственный путь создания строк, а лишь заблаговременный.
@Injectable()
export class SalesPlanAutoCreationCron {
    private readonly logger = new Logger(SalesPlanAutoCreationCron.name);

    constructor(
        private readonly ensureSalesPlans: EnsureSalesPlansForPeriodService,
    ) {}

    @ProdCron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async run(): Promise<void> {
        // Тот же UTC-расчёт "текущего периода", что и в Period.getBounds() —
        // иначе план и факт разъедутся на сутки (см. PRD, раздел "Фаза 4").
        const period = Period.current().getValue();

        try {
            // Крон выполняется вне HTTP-запроса — RequestContext, который
            // читают репозитории/домен, никем не открыт (см. комментарий в
            // run-in-system-context.ts), поэтому открываем его вручную.
            await runInSystemRequestContext(() =>
                this.ensureSalesPlans.ensure('service', period),
            );
            this.logger.log(`Sales plans ensured for period ${period}`);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to auto-create sales plans for ${period}: ${message}`,
            );
            logCronError('SalesPlanAutoCreationCron.run', error, { period });
        }
    }
}
