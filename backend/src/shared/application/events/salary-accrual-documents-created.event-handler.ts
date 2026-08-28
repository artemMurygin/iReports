import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SalaryAccrualDocumentsCreatedDomainEvent } from '@/domains/service/modules/accounting/domain/events/salary-accrual-documents-created.domain-event';

// Временный лог-хендлер — как AccountingPeriodClosedEventHandler:
// подтверждает, что SalaryAccrualDocumentsCreatedDomainEvent публикуется
// после коммита транзакции закрытия (обоими хендлерами закрытия — service
// и shop). Реальный подписчик (проведение на баланс) — PRD 2.
@Injectable()
export class SalaryAccrualDocumentsCreatedEventHandler {
    private readonly logger = new Logger(
        SalaryAccrualDocumentsCreatedEventHandler.name,
    );

    @OnEvent('SalaryAccrualDocumentsCreatedDomainEvent')
    handle(event: SalaryAccrualDocumentsCreatedDomainEvent): void {
        this.logger.log(
            `Документы начисления созданы: direction=${event.direction}, ` +
                `period=${event.period}, документов=${event.accrualIds.length}`,
        );
    }
}
