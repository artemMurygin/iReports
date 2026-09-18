import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { getErrorMessage } from '@/shared/utils/getErrorMessage';
import { TaskClosedDomainEvent } from '@/modules/tasks/domain/events/task-closed.domain-event';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';

// Группа 5 tasks.md (deactivate-one-off-task-completion-rule) — зеркало
// domains/service/modules/accounting'ного TaskClosedEventHandler
// (независимая реализация, design.md Decision 2): подписывается на общее
// (сквозной модуль tasks) TaskClosedDomainEvent и деактивирует ТОЛЬКО
// разовое (isRecurring === false) правило TaskCompletion направления shop,
// если оно ссылается на закрывшуюся задачу — не зная о правилах
// направления service (изоляция service/shop, backend/CLAUDE.md,
// «Общие таблицы между service и shop»). spec:
// deactivate-one-off-task-completion-rule/shop/accounting#requirement-разовое-правило-за-выполнение-задачи-деактивируется-по-исходу-задачи
//
// Успешное закрытие (CLOSED_SUCCESSFULLY) — no-op здесь: деактивация в этом
// случае происходит позже, при фиксации фактической суммы начисления
// (SetShopTaskCompletionLineRewardHandler, design.md Decision 4).
//
// Событие публикуется EventEmitter2 уже ПОСЛЕ коммита транзакции закрытия
// задачи (DatabaseService.withTransaction/AggregateRoot.publishEvents) —
// откат исходной транзакции из-за сбоя этой реакции невозможен и не нужен,
// поэтому ошибка логируется и не пробрасывается (тот же приём, что у
// CloseGoodsTurnoverPeriod в domains/service/modules/warehouse).
@Injectable()
export class TaskClosedEventHandler {
    private readonly logger = new Logger(TaskClosedEventHandler.name);

    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: ShopSalaryRuleRepositoryPort,
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
