import { Injectable } from '@nestjs/common';
import type { TaskRuleStatus } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { BitrixTaskRuleStatusItem } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { toTaskRuleStatus } from '@/domains/service/modules/accounting/application/mappers/to-task-rule-status';
import { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';

// Requirement "Список незакрытых задач перед закрытием периода" (spec.md):
// правила-задачи месяца, чьи задачи НЕ в статусе "Закрыта" — включая
// недоступные (задача не может быть закрыта, если её вообще не видно).
// bitrixTaskId/status — undefined у недоступного правила (isUnavailable:
// true), тем же приёмом, что и bitrixTaskUrl/taskStatus в
// employeeSalaryReportRuleSchema (contracts) — "недоступна" не то же самое,
// что "не найдена ни для одного статуса", поэтому оба поля описаны как
// опциональные, а не как unavailable-only ветка union.
export interface UnclosedTaskRule {
    ruleId: string;
    employeeId: number;
    ruleName: string;
    bitrixTaskId?: number;
    status?: TaskRuleStatus;
    isUnavailable: boolean;
}

// Единственный пакетный запрос статусов на ВЕСЬ период (spec.md, "Пакетный
// запрос статусов") — собирает bitrixTaskIds всех правил TaskCompleted всех
// сотрудников (ResolveEmployeeSalaryRulesService.forAllTargets, тот же вход,
// что и у CalculateServiceSnapshotRowsService — "все сотрудники, у которых
// есть зарплатные правила"), одним getTasksBatch, затем локально
// сопоставляет каждому правилу задачу, относящуюся к запрошенному периоду
// (TaskCompletedEntity.findTaskForPeriod — тот же метод, что использует
// calculate(), см. WHY там).
@Injectable()
export class ListUnclosedTaskRulesForPeriodService {
    constructor(
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
        private readonly bitrixTasksService: BitrixTasksService,
    ) {}

    async execute(periodValue: string): Promise<UnclosedTaskRule[]> {
        const period = Period.create(periodValue).getValue();

        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();

        const taskRules: { employeeId: number; rule: TaskCompletedEntity }[] =
            [];
        for (const [employeeId, { rules }] of salaryRulesByEmployee) {
            for (const rule of rules) {
                if (rule instanceof TaskCompletedEntity) {
                    taskRules.push({ employeeId, rule });
                }
            }
        }
        if (taskRules.length === 0) {
            return [];
        }

        const statusesByTaskId = await this.fetchStatuses(taskRules);

        const result: UnclosedTaskRule[] = [];
        for (const { employeeId, rule } of taskRules) {
            const matched = rule.findTaskForPeriod(statusesByTaskId, period);
            if (matched) {
                if (matched.status === 'COMPLETED') {
                    continue;
                }
                result.push({
                    ruleId: rule.id,
                    employeeId,
                    ruleName: rule.name,
                    bitrixTaskId: matched.id,
                    status: matched.status ?? undefined,
                    isUnavailable: false,
                });
                continue;
            }
            if (rule.isCurrentTaskUnavailable(statusesByTaskId)) {
                result.push({
                    ruleId: rule.id,
                    employeeId,
                    ruleName: rule.name,
                    isUnavailable: true,
                });
            }
            // Ни один накопленный bitrixTaskId не относится к period, и
            // "текущая" задача доступна (просто перенесена на другой
            // месяц) — правило не относится к этому периоду вовсе, не
            // попадает в список (см. WHY у
            // TaskCompletedEntity._buildUnavailableOrIrrelevantLine).
        }
        return result;
    }

    // Один batched-вызов на все bitrixTaskIds всех правил-задач разом —
    // независимо от числа правил (spec.md, "Пакетный запрос статусов").
    private async fetchStatuses(
        taskRules: { employeeId: number; rule: TaskCompletedEntity }[],
    ): Promise<Map<number, BitrixTaskRuleStatusItem>> {
        const ids = new Set<number>();
        for (const { rule } of taskRules) {
            for (const id of rule.bitrixTaskIds) {
                ids.add(id);
            }
        }
        if (ids.size === 0) {
            return new Map();
        }
        const batch = await this.bitrixTasksService.getTasksBatch([...ids]);
        return new Map(
            batch.map((item) => [
                item.id,
                {
                    id: item.id,
                    isAvailable: item.isAvailable,
                    status: toTaskRuleStatus(item.status),
                    period: item.period,
                },
            ]),
        );
    }
}
