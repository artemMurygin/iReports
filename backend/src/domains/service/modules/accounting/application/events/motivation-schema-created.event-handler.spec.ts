import { Logger } from '@nestjs/common';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { MotivationSchemaCreatedEventHandler } from './motivation-schema-created.event-handler';
import { MotivationSchemaCreatedDomainEvent } from '@/domains/service/modules/accounting/domain/events/motivation-schema-created.domain-event';

describe('MotivationSchemaCreatedEventHandler', () => {
    it('логирует id, targetType/targetId, name и число правил из события', () => {
        withRequestContext(() => {
            const logSpy = jest
                .spyOn(Logger.prototype, 'log')
                .mockImplementation();
            const handler = new MotivationSchemaCreatedEventHandler();
            const event = new MotivationSchemaCreatedDomainEvent({
                aggregateId: 'schema-1',
                targetType: 'Employee',
                targetId: 7,
                name: 'Оклад',
                rules: [],
            });

            handler.handle(event);

            expect(logSpy).toHaveBeenCalledTimes(1);
            const message = logSpy.mock.calls[0][0] as string;
            expect(message).toContain('schema-1');
            expect(message).toContain('Employee');
            expect(message).toContain('7');
            expect(message).toContain('Оклад');
            expect(message).toContain('rules=0');

            logSpy.mockRestore();
        });
    });
});
