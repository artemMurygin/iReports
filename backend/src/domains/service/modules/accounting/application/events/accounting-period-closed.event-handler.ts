import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountingPeriodClosedDomainEvent } from '@/domains/service/modules/accounting/domain/events/accounting-period-closed.domain-event';

// Временный лог-хендлер — как и MotivationSchemaCreatedEventHandler в своё
// время в Фазе 1: подтверждает, что AccountingPeriodClosedDomainEvent
// реально долетает до EventEmitter2 после коммита транзакции закрытия (см.
// DatabaseService.withTransaction). Формирование salaryReport по этому
// событию (PRD: "Месяц закрыт → формирование salaryReport") — вне скоупа
// Фазы 6 (см. "Не в скоупе" PRD: "Баланс сотрудника и начисление зарплаты"),
// сюда подключается отдельной итерацией без изменения самого события.
@Injectable()
export class AccountingPeriodClosedEventHandler {
    private readonly logger = new Logger(
        AccountingPeriodClosedEventHandler.name,
    );

    @OnEvent('AccountingPeriodClosedDomainEvent')
    handle(event: AccountingPeriodClosedDomainEvent): void {
        this.logger.log(
            `Период закрыт: direction=${event.direction}, period=${event.period}, ` +
                `closedBy=${event.closedBy}, снапшот по сотрудникам=${event.employeeCount}`,
        );
    }
}
