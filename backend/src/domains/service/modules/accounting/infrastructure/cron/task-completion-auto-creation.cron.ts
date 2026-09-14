import { Injectable, Logger } from '@nestjs/common';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import {
    EnsureRuleTaskForPeriodService,
    filterRecurringTaskCompletionRules,
} from '@/domains/service/modules/accounting/application/services/task-completion/ensure-rule-task-for-period.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';

// 1 число месяца, 10:00 (по требованию: не полночь, как у соседнего
// SalesPlanAutoCreationCron/EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT — своё
// cron-выражение, а не общий CronExpression) — заблаговременно заводит
// задачу регулярного TaskCompletion-правила, восстанавливая отдельный
// триггер, который раньше был удалён (см. WHY в
// EnsureRuleTaskForPeriodService и AccountingModule). ensure() идемпотентен,
// поэтому ленивый вызов из GetEmployeeSalaryReportService/
// GetDepartmentSalaryReportService не убран и остаётся подстраховкой для
// dev/окружений без ENABLE_CRON=true (@ProdCron тикает только в проде, см.
// prod-cron.decorator.ts) — этот крон лишь становится основным,
// заблаговременным источником задачи в проде, тем же приёмом, что уже
// применён для планов продаж (SalesPlanAutoCreationCron).
@Injectable()
export class TaskCompletionAutoCreationCron {
    private readonly logger = new Logger(TaskCompletionAutoCreationCron.name);

    constructor(
        private readonly ensureRuleTask: EnsureRuleTaskForPeriodService,
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
    ) {}

    @ProdCron('0 10 1 * *')
    async run(): Promise<void> {
        // Тот же UTC-расчёт "текущего периода", что и в
        // SalesPlanAutoCreationCron/Period.current().
        const period = Period.current().getValue();

        try {
            // Крон выполняется вне HTTP-запроса — RequestContext, который
            // читают репозитории/домен, никем не открыт (см. комментарий в
            // run-in-system-context.ts), поэтому открываем его вручную.
            await runInSystemRequestContext(() => this.ensureAll(period));
            this.logger.log(
                `TaskCompletion tasks ensured for period ${period}`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to auto-create TaskCompletion tasks for ${period}: ${message}`,
            );
            logCronError('TaskCompletionAutoCreationCron.run', error, {
                period,
            });
        }
    }

    private async ensureAll(period: string): Promise<void> {
        const byEmployee = await this.salaryRulesResolver.forAllTargets();

        for (const [employeeId, resolved] of byEmployee) {
            const recurringTaskRules = filterRecurringTaskCompletionRules(
                resolved.rules,
            );
            for (const rule of recurringTaskRules) {
                await this.ensureRuleTask.ensure(rule, period, employeeId);
            }
        }
    }
}
