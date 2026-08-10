import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MotivationSchemaCreatedDomainEvent } from '@/domains/service/modules/accounting/domain/events/motivation-schema-created.domain-event';

// Временный лог-хендлер для проверки, что MotivationSchemaCreatedDomainEvent
// реально долетает до EventEmitter2 после коммита транзакции (см.
// DatabaseService.withTransaction / PrismaRepository.write). Имя события —
// это event.constructor.name, см. AggregateRoot.publishEvents.
@Injectable()
export class MotivationSchemaCreatedEventHandler {
    private readonly logger = new Logger(
        MotivationSchemaCreatedEventHandler.name,
    );

    @OnEvent('MotivationSchemaCreatedDomainEvent')
    handle(event: MotivationSchemaCreatedDomainEvent): void {
        this.logger.log(
            `MotivationSchema создана: id=${event.aggregateId}, ` +
                `targetType=${event.targetType}, targetId=${event.targetId}, ` +
                `name="${event.name}", rules=${event.rules.length}`,
        );
    }
}
