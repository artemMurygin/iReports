import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { getErrorMessage } from '@/shared/utils/getErrorMessage';
import { TaskClosedDomainEvent } from '@/modules/tasks/domain/events/task-closed.domain-event';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';

// Группа 4 tasks.md (deactivate-one-off-task-completion-rule) — зеркало
// domains/shop/modules/accounting'ного TaskClosedEventHandler (независимая
// реализация, design.md Decision 2): подписывается на общее (сквозной
// модуль tasks) TaskClosedDomainEvent и деактивирует ТОЛЬКО разовое
// (isRecurring === false) правило TaskCompletion направления service, если
// оно ссылается на закрывшуюся задачу — не зная о правилах направления shop
// (изоляция service/shop, backend/CLAUDE.md, «Общие таблицы между service и
// shop»). spec:
// deactivate-one-off-task-completion-rule/service/accounting#requirement-разовое-правило-за-выполнение-задачи-деактивируется-по-исходу-задачи
//
// Успешное закрытие (CLOSED_SUCCESSFULLY) — no-op здесь: деактивация в этом
// случае происходит позже, при фиксации фактической суммы начисления
// (SetTaskCompletionLineRewardHandler, design.md Decision 4).
//
// Событие публикуется EventEmitter2 уже ПОСЛЕ коммита транзакции закрытия
// задачи (DatabaseService.withTransaction/AggregateRoot.publishEvents) —
// откат исходной транзакции из-за сбоя этой реакции невозможен и не нужен,
// поэтому ошибка логируется и не пробрасывается (тот же приём, что у
// зеркального обработчика shop).
@Injectable()
export class TaskClosedEventHandler {
    private readonly logger = new Logger(TaskClosedEventHandler.name);

    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
    ) {}

    @OnEvent('TaskClosedDomainEvent')
    async handle(event: TaskClosedDomainEvent): Promise<void> {
        if (event.status !== 'CLOSED_UNSUCCESSFULLY') {
            return;
        }

        try {
            const rule = await this.salaryRuleRepo.findOneOffByAnyTaskId(
                event.taskId,
            );
            if (!rule || !rule.isActive) {
                return;
            }

            rule.deactivate();
            await this.salaryRuleRepo.update(rule);
            this.logger.log(
                `Разовое правило «за выполнение задачи» деактивировано неуспешным закрытием задачи: ruleId=${rule.id}, taskId=${event.taskId}`,
            );
        } catch (error) {
            this.logger.error(
                `Не удалось деактивировать разовое правило по taskId=${event.taskId}: ${getErrorMessage(error)}`,
            );
        }
    }
}
