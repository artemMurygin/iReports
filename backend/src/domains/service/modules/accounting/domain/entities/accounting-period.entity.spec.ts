import { AccountingPeriod } from './accounting-period.entity';
import {
    PeriodAlreadyClosedException,
    PeriodNotClosedException,
} from '../exceptions/accounting-period.exception';
import { AccountingPeriodClosedDomainEvent } from '../events/accounting-period-closed.domain-event';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('AccountingPeriod', () => {
    it('создаётся открытым', () => {
        const period = AccountingPeriod.openFor({
            direction: 'service',
            period: '2026-08',
        });

        expect(period.status).toBe('OPEN');
        expect(period.isOpen()).toBe(true);
        expect(period.closedBy).toBeNull();
        expect(period.closedAt).toBeNull();
    });

    it('close() закрывает период, фиксирует закрывшего и порождает AccountingPeriodClosedDomainEvent', () => {
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });

            period.close(7, 3);

            expect(period.status).toBe('CLOSED');
            expect(period.isClosed()).toBe(true);
            expect(period.closedBy).toBe(7);
            expect(period.closedAt).toBeInstanceOf(Date);
            expect(period.domainEvents).toHaveLength(1);
            const [event] = period.domainEvents as [
                AccountingPeriodClosedDomainEvent,
            ];
            expect(event).toBeInstanceOf(AccountingPeriodClosedDomainEvent);
            expect(event.direction).toBe('service');
            expect(event.period).toBe('2026-08');
            expect(event.closedBy).toBe(7);
            expect(event.employeeCount).toBe(3);
        });
    });

    it('повторное close() уже закрытого периода отклоняется', () => {
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });
            period.close(7, 0);

            expect(() => period.close(7, 0)).toThrow(
                PeriodAlreadyClosedException,
            );
        });
    });

    it('reopen() открытого периода отклоняется', () => {
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });

            expect(() => period.reopen()).toThrow(PeriodNotClosedException);
        });
    });

    it('reopen() закрытого периода снимает статус и закрытие целиком', () => {
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });
            period.close(7, 0);

            period.reopen();

            expect(period.status).toBe('OPEN');
            expect(period.closedBy).toBeNull();
            expect(period.closedAt).toBeNull();
        });
    });

    it('направления сервиса и магазина закрываются независимо (разные агрегаты по direction)', () => {
        withRequestContext(() => {
            const service = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });
            const shop = AccountingPeriod.openFor({
                direction: 'shop',
                period: '2026-08',
            });

            service.close(1, 0);

            expect(service.isClosed()).toBe(true);
            expect(shop.isOpen()).toBe(true);
        });
    });
});
