import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { runInSystemRequestContext } from '@/shared/application/context/run-in-system-context';
import { Period } from '@/shared/domain/period.value-object';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { EnsureBitrixTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/ensure-bitrix-task-for-period.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';

// Автосоздание задачи Bitrix24 нового месяца для регулярных правил
// TaskCompleted, первого числа (задача 7.1 change salary-rule-bitrix-task,
// design.md Decision 5) — по образцу SalesPlanAutoCreationCron
// (domains/service/modules/sales/infrastructure/cron/sales-plan-auto-creation.cron.ts):
// @ProdCron реально тикает только в проде, ensure() внутри
// EnsureBitrixTaskForPeriodService идемпотентен сам по себе (проверяет по
// живым данным Bitrix24, а не по локальной БД-уникальности), поэтому
// повторный тик за тот же месяц не создаёт вторую задачу. Ленивое
// достраивание при GET схемы/отчёта (задача 7.2,
// EnsureTaskRulesOnReadService) — второй, не единственный вход в ту же
// операцию, нужный потому что этот крон не тикает в dev (см. WHY у
// SalesPlanAutoCreationCron).
//
// Направление: только service. Правило TaskCompleted направления shop
// (domains/shop/modules/accounting/domain/entities/salary-rules/task-completed.entity.ts,
// TaskCompletedShopEntity) на момент этой задачи ещё не переведено на
// Bitrix24 — у него нет ни bitrixTaskIds в конфиге, ни своего аналога
// EnsureBitrixTaskForPeriodService/ShopSalaryRuleRepositoryPort.update()
// (см. отчёт агента задач 7.1/7.2: домен/application-слой shop для этого
// change'а — задачи 4-6 по аналогии с service — не реализованы; контракт
// shop уже обновлён под новую форму, но домен ещё нет). Включение shop сюда
// требует сначала завести этот слой для shop, что не входит в задачи 7.1/
// 7.2 — намеренное ограничение, а не забытая ветка direction.
@Injectable()
export class TaskRuleAutoCreationCron {
    private readonly logger = new Logger(TaskRuleAutoCreationCron.name);

    constructor(
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
        private readonly ensureBitrixTask: EnsureBitrixTaskForPeriodService,
    ) {}

    @ProdCron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
    async run(): Promise<void> {
        const period = Period.current().getValue();

        try {
            // Крон выполняется вне HTTP-запроса — RequestContext, который
            // читают репозитории/домен, никем не открыт (см. комментарий в
            // run-in-system-context.ts), поэтому открываем его вручную —
            // тот же приём, что и SalesPlanAutoCreationCron.
            await runInSystemRequestContext(() => this.ensureAll(period));
            this.logger.log(`Bitrix task rules ensured for period ${period}`);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to auto-create task rules for ${period}: ${message}`,
            );
            logCronError('TaskRuleAutoCreationCron.run', error, { period });
        }
    }

    private async ensureAll(period: string): Promise<void> {
        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();

        for (const [employeeId, { rules }] of salaryRulesByEmployee) {
            for (const rule of rules) {
                if (!(rule instanceof TaskCompletedEntity)) {
                    continue;
                }
                try {
                    await this.ensureBitrixTask.ensure(
                        rule,
                        period,
                        employeeId,
                    );
                } catch (error) {
                    // Ошибка одного правила (например, Bitrix24 временно
                    // недоступен на одном запросе) не должна блокировать
                    // автосоздание задач остальных правил этого же тика —
                    // логируем и продолжаем, а не прерываем весь цикл.
                    const message =
                        error instanceof Error ? error.message : String(error);
                    this.logger.error(
                        `Failed to ensure Bitrix task for rule ${rule.id} ` +
                            `(employee ${employeeId}, period ${period}): ${message}`,
                    );
                    logCronError('TaskRuleAutoCreationCron.ensure', error, {
                        period,
                        ruleId: rule.id,
                        employeeId,
                    });
                }
            }
        }
    }
}
