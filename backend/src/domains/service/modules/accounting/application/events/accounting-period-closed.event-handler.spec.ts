import { Logger } from '@nestjs/common';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { AccountingPeriodClosedEventHandler } from './accounting-period-closed.event-handler';
import { AccountingPeriodClosedDomainEvent } from '@/domains/service/modules/accounting/domain/events/accounting-period-closed.domain-event';

describe('AccountingPeriodClosedEventHandler', () => {
    it('логирует направление, период, закрывшего и число сотрудников в снапшоте', () => {
        withRequestContext(() => {
            const logSpy = jest
                .spyOn(Logger.prototype, 'log')
                .mockImplementation();
            const handler = new AccountingPeriodClosedEventHandler();
            const event = new AccountingPeriodClosedDomainEvent({
                aggregateId: 'period-1',
                direction: 'service',
                period: '2026-08',
                closedBy: 7,
                employeeCount: 3,
            });

            handler.handle(event);

            expect(logSpy).toHaveBeenCalledTimes(1);
            const message = logSpy.mock.calls[0][0] as string;
            expect(message).toContain('service');
            expect(message).toContain('2026-08');
            expect(message).toContain('7');
            expect(message).toContain('3');

            logSpy.mockRestore();
        });
    });
});
