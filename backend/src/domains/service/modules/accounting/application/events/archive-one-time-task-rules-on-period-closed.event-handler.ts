import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountingPeriodClosedDomainEvent } from '@/domains/service/modules/accounting/domain/events/accounting-period-closed.domain-event';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';

// Фаза 1 docs/task-rule-archiving-and-links (Tracer Bullet) — как только
// закрывается расчётный период, все разовые (isRecurring: false) ACTIVE
// правила-задачи, чей dueDate относится к этому периоду, переводятся в
// ARCHIVED. Архивация не зависит от исхода задачи в Bitrix24 (задача
// "Закрыта" или дедлайн прошёл без выполнения) — фильтр вообще не смотрит
// на статус задачи, только на dueDate/isRecurring/status правила (PRD, "В
// скоупе": "независимо от того, была ли задача выполнена ... или дедлайн
// прошёл без выполнения").
//
// Регулярные правила (isRecurring: true) не архивируются никогда — им
// статус не присваивается вовсе (см. WHY у TaskCompletedRuleStatus).
//
// Расположение и стиль — по образцу AccountingPeriodClosedEventHandler
// (тот же application/events/, тот же @OnEvent('AccountingPeriodClosedDomainEvent'));
// отдельный класс, а не расширение лог-хендлера — здесь другая
// ответственность (мутация состояния правил, а не диагностический лог), и
// у обработчиков domain-событий в проекте нет требования на единственность
// подписчика на одно событие (EventEmitter2.emitAsync у AggregateRoot
// ждёт все подписки).
//
// Работает после коммита транзакции закрытия периода (событие публикуется
// из DatabaseService.withTransaction ПОСЛЕ реального commit, см.
// AggregateRoot.publishEvents) — RequestContext уже открыт тем же HTTP-
// запросом, что и закрытие (в отличие от кронов вроде
// SalesPlanAutoCreationCron, здесь НЕ нужен runInSystemRequestContext).
@Injectable()
export class ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler {
    private readonly logger = new Logger(
        ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler.name,
    );

    constructor(
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepository: SalaryRuleRepositoryPort,
    ) {}

    @OnEvent('AccountingPeriodClosedDomainEvent')
    async handle(event: AccountingPeriodClosedDomainEvent): Promise<void> {
        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();

        // Map по id, а не просто массив — защита от повторной обработки
        // одного и того же правила, если один и тот же объект правила
        // когда-либо попадёт в выборку более одного раза (сейчас такого не
        // бывает: TaskCompleted доступен только в схеме на сотрудника, не
        // на отдел, см. Requirement "Создание правила-задачи только в
        // схеме на сотрудника"), — archive() бросает исключение на уже
        // ARCHIVED правиле, дважды вызывать его на одном объекте нельзя.
        const rulesToArchive = new Map<string, TaskCompletedEntity>();
        for (const { rules } of salaryRulesByEmployee.values()) {
            for (const rule of rules) {
                if (
                    rule instanceof TaskCompletedEntity &&
                    !rule.config.isRecurring &&
                    rule.status === 'ACTIVE' &&
                    rule.isDueInPeriod(event.period)
                ) {
                    rulesToArchive.set(rule.id, rule);
                }
            }
        }

        for (const rule of rulesToArchive.values()) {
            rule.archive();
            await this.salaryRuleRepository.update(rule);
        }

        if (rulesToArchive.size > 0) {
            this.logger.log(
                `Период ${event.period} направления "${event.direction}" закрыт: ` +
                    `заархивировано разовых правил-задач: ${rulesToArchive.size}`,
            );
        }
    }
}
