import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import {
    EnsureSalaryTaskForPeriodService,
    filterRecurringTaskCompletionRules,
} from '@/domains/service/modules/accounting/application/services/salary-task/ensure-salary-task-for-period.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';

// Раздел 11 tasks.md (add-task-based-salary-rule), design.md Decision 4 — по
// образцу SalesPlanAutoCreationCron: заранее (первого числа месяца)
// достраивает задачи Bitrix24 регулярных правил TaskCompletion на новый
// расчётный период, чтобы к моменту, когда руководитель/сотрудник открывает
// отчёт, задача уже была заведена (см. также ленивый вызов того же
// ensure() в GetEmployeeSalaryReportService/GetDepartmentSalaryReportService
// — @ProdCron не тикает в dev).
//
// Источник "всех активных правил-задач" — уже существующий
// ResolveEmployeeSalaryRulesService.forAllTargets() (тот же метод, что
// использует закрытие периода: все сотрудники с личной схемой ПЛЮС все
// сотрудники отделов с назначенной схемой), а не отдельное перечисление
// через SALARY_RULE_REPOSITORY — EnsureSalaryTaskForPeriodService уже
// использует SALARY_RULE_REPOSITORY только для чтения config одного
// конкретного правила внутри ensure(), не для обхода схем.
//
// Обработка последовательная (не Promise.all) — та же простота, что у
// SalesPlanAutoCreationCron: ошибка на одном правиле прерывает текущий
// проход целиком (см. catch ниже), остальные будут досозданы либо
// следующим тиком крона, либо ленивым вызовом при следующем открытии
// отчёта — не критично для гранулярности "раз в месяц".
@Injectable()
export class TaskCompletionAutoCreationCron {
    private readonly logger = new Logger(TaskCompletionAutoCreationCron.name);

    constructor(
        private readonly ensureSalaryTask: EnsureSalaryTaskForPeriodService,
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
    ) {}

    @ProdCron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async run(): Promise<void> {
        // Тот же UTC-расчёт "текущего периода", что и у
        // SalesPlanAutoCreationCron — иначе крон и ленивый вызов из отчёта
        // разъедутся на сутки около границы месяца.
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
                await this.ensureSalaryTask.ensure(rule.id, period, employeeId);
            }
        }
    }
}
