import { Inject, Injectable } from '@nestjs/common';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';

// Автосоздание задачи регулярного правила на новый расчётный месяц
// (design.md change salary-rule-bitrix-task, Decision 5) — идемпотентно:
// пакетно проверяет периоды уже накопленных bitrixTaskIds правила и
// создаёт новую задачу, только если НИ ОДИН из них не относится к
// запрошенному периоду. Идемпотентность — за счёт этой проверки по живым
// данным Bitrix24 (не по локальной БД-уникальности, см. design.md: "решение
// принимается по живым данным Bitrix, не по локальной таблице").
//
// Два входа в одну операцию (см. WHY у SalesPlan-аналога,
// EnsureSalesPlansForPeriodService): TaskRuleAutoCreationCron (задача 7.1,
// первого числа месяца, @ProdCron — не тикает в dev) и ленивое достраивание
// при чтении схемы/отчёта (задача 7.2) — ни один из двух входов не входит в
// эту фазу задач, этот сервис лишь реализует саму операцию `ensure`.
//
// responsibleId — третий параметр (design.md прозой даёт сигнатуру
// ensure(rule, period), но responsibleId — сотрудник, ответственный за
// задачу Bitrix24, — сущности SalaryRule неизвестен: правило не хранит
// employeeId, только конфигурацию; см. TaskCompletedEntity, Decision 1).
// Вызывающая сторона (крон/ленивое достраивание, обе — задачи Фазы 7, не
// этой) уже резолвит правила по сотрудникам их схем, поэтому знает
// employeeId/responsibleId дешевле, чем этот сервис резолвил бы его заново
// по motivationSchemaId.
@Injectable()
export class EnsureBitrixTaskForPeriodService {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        private readonly bitrixTasksService: BitrixTasksService,
    ) {}

    async ensure(
        rule: TaskCompletedEntity,
        period: string,
        responsibleId: number,
    ): Promise<void> {
        // Автосоздание — только для регулярных правил (Requirement
        // "Автосоздание задач для регулярных правил", spec.md); разовое
        // правило имеет одну-единственную задачу на весь свой срок жизни,
        // повторный ensure() для него не создаёт вторую.
        if (!rule.config.isRecurring) {
            return;
        }

        if (await this.hasTaskForPeriod(rule, period)) {
            return;
        }

        const taskId = await this.bitrixTasksService.createTask({
            title: rule.name,
            description: rule.config.description,
            responsibleId,
            deadline: this.resolveDeadline(rule, period),
            period,
        });

        rule.addBitrixTaskId(taskId);
        await this.salaryRuleRepo.update(rule);
    }

    // Пакетный запрос статусов/периодов ВСЕХ накопленных bitrixTaskIds
    // правила (design.md: "пакетно получает периоды всех bitrixTaskIds
    // правила") — идемпотентность держится именно на этой проверке, не на
    // локальной БД.
    private async hasTaskForPeriod(
        rule: TaskCompletedEntity,
        period: string,
    ): Promise<boolean> {
        const taskIds = rule.bitrixTaskIds;
        if (taskIds.length === 0) {
            return false;
        }
        const batch = await this.bitrixTasksService.getTasksBatch(taskIds);
        return batch.some((item) => item.isAvailable && item.period === period);
    }

    // Дедлайн новой задачи регулярного месяца — тот же день месяца, что и у
    // исходного config.dueDate правила, перенесённый в новый период
    // (clamp на последний день, если в новом месяце меньше дней — тот же
    // приём, что и у lastDayOfPeriod в contracts/commands/salary-rule.ts).
    // Design.md явно не фиксирует правило переноса дедлайна на
    // регенерированный месяц — это принятое допущение (см. notes агента),
    // выбранное как самое буквальное прочтение "новая задача того же
    // содержания" (Requirement "Автосоздание задач для регулярных правил").
    private resolveDeadline(rule: TaskCompletedEntity, period: string): Date {
        const originalDay = Number(rule.config.dueDate.slice(-2));
        const [year, month] = period.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(originalDay, lastDay);
        const dueDate = `${period}-${String(day).padStart(2, '0')}`;
        return new Date(`${dueDate}T00:00:00.000Z`);
    }
}
