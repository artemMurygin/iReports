import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import {
    EnsureShopSalaryTaskForPeriodService,
    filterRecurringTaskCompletionShopRules,
} from '@/domains/shop/modules/accounting/application/services/salary-task/ensure-salary-task-for-period.service';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';

// Раздел 16 tasks.md (add-task-based-salary-rule), design.md Decision 4 —
// зеркало TaskCompletionAutoCreationCron направления service (раздел 11,
// issue #57 — независимая копия), по образцу ShopSalesPlanAutoCreationCron:
// заранее (первого числа месяца) достраивает задачи Bitrix24 регулярных
// правил TaskCompletion на новый расчётный период, чтобы к моменту, когда
// руководитель/сотрудник открывает отчёт, задача уже была заведена (см.
// также ленивый вызов того же ensure() в GetShopEmployeeSalaryReportService/
// GetShopDepartmentSalaryReportService — @ProdCron не тикает в dev).
//
// Источник "всех активных правил-задач" — уже существующий
// ResolveShopEmployeeSalaryRulesService.forAllTargets() (тот же метод, что
// использует закрытие периода: все сотрудники с личной схемой ПЛЮС все
// сотрудники отделов с назначенной схемой), а не отдельное перечисление
// через SHOP_SALARY_RULE_REPOSITORY — EnsureShopSalaryTaskForPeriodService
// уже использует SHOP_SALARY_RULE_REPOSITORY только для чтения config
// одного конкретного правила внутри ensure(), не для обхода схем.
//
// Обработка последовательная (не Promise.all) — та же простота, что у
// зеркального крона направления service/ShopSalesPlanAutoCreationCron:
// ошибка на одном правиле прерывает текущий проход целиком (см. catch
// ниже), остальные будут досозданы либо следующим тиком крона, либо
// ленивым вызовом при следующем открытии отчёта — не критично для
// гранулярности "раз в месяц".
@Injectable()
export class ShopTaskCompletionAutoCreationCron {
    private readonly logger = new Logger(
        ShopTaskCompletionAutoCreationCron.name,
    );

    constructor(
        private readonly ensureSalaryTask: EnsureShopSalaryTaskForPeriodService,
        private readonly salaryRulesResolver: ResolveShopEmployeeSalaryRulesService,
    ) {}

    @ProdCron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async run(): Promise<void> {
        // Тот же UTC-расчёт "текущего периода", что и у
        // ShopSalesPlanAutoCreationCron — иначе крон и ленивый вызов из
        // отчёта разъедутся на сутки около границы месяца.
        const period = Period.current().getValue();

        try {
            // Крон выполняется вне HTTP-запроса — RequestContext, который
            // читают репозитории/домен, никем не открыт, поэтому открываем
            // его вручную.
            await runInSystemRequestContext(() => this.ensureAll(period));
            this.logger.log(
                `Shop task completion tasks ensured for period ${period}`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to auto-create shop task completion tasks for ${period}: ${message}`,
            );
            logCronError('ShopTaskCompletionAutoCreationCron.run', error, {
                period,
            });
        }
    }

    private async ensureAll(period: string): Promise<void> {
        const byEmployee = await this.salaryRulesResolver.forAllTargets();

        for (const [employeeId, resolved] of byEmployee) {
            const recurringTaskRules = filterRecurringTaskCompletionShopRules(
                resolved.rules,
            );
            for (const rule of recurringTaskRules) {
                await this.ensureSalaryTask.ensure(rule.id, period, employeeId);
            }
        }
    }
}
