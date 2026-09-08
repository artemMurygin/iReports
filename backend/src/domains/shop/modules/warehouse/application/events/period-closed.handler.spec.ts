import { GoodsTurnoverPeriodClosedHandler } from './period-closed.handler';
import type { RebuildGoodsTurnoverReportService } from '@/domains/shop/modules/warehouse/application/services/goods-turnover-report/rebuild-goods-turnover-report.service';
import { ShopAccountingPeriodClosedDomainEvent } from '@/domains/shop/modules/accounting/domain/events/accounting-period-closed.domain-event';
import { Period } from '@/shared/domain/period.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('GoodsTurnoverPeriodClosedHandler.handle', () => {
    const buildEvent = (period: string) =>
        withRequestContext(
            () =>
                new ShopAccountingPeriodClosedDomainEvent({
                    aggregateId: 'period-1',
                    period,
                    closedBy: 42,
                    employeeCount: 3,
                }),
        );

    it('пересчитывает и фиксирует снэпшот отчёта за период из события', async () => {
        const rebuild = jest.fn().mockResolvedValue(undefined);
        const handler = new GoodsTurnoverPeriodClosedHandler({
            rebuild,
        } as unknown as RebuildGoodsTurnoverReportService);

        await handler.handle(buildEvent('2026-08'));

        expect(rebuild).toHaveBeenCalledTimes(1);
        const [calledPeriod] = rebuild.mock.calls[0] as [Period];
        expect(calledPeriod.getValue()).toBe('2026-08');
    });

    it('не выбрасывает исключение при ошибке пересчёта — только логирует (закрытие периода уже свершилось)', async () => {
        const rebuild = jest.fn().mockRejectedValue(new Error('db down'));
        const handler = new GoodsTurnoverPeriodClosedHandler({
            rebuild,
        } as unknown as RebuildGoodsTurnoverReportService);

        await expect(
            handler.handle(buildEvent('2026-08')),
        ).resolves.toBeUndefined();
    });
});
