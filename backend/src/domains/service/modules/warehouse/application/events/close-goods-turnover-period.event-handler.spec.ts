import { Logger } from '@nestjs/common';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { CloseGoodsTurnoverPeriod } from './close-goods-turnover-period.event-handler';
import type { GoodsTurnoverReportLineRepositoryPort } from '../ports/goods-turnover-report/goods-turnover-report-line.port';
import type { BuildGoodsTurnoverReportService } from '../services/build-goods-turnover-report.service';
import { AccountingPeriodClosedDomainEvent } from '@/domains/service/modules/accounting/domain/events/accounting-period-closed.domain-event';
import { GoodsTurnoverReport } from '../../domain/entities/goods-turnover-report/goods-turnover-report.entity';
import { GoodsTurnoverReportLine } from '../../domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '../../domain/value-objects/goods-flow-metric.value-object';

function buildLine(): GoodsTurnoverReportLine {
    const line = GoodsTurnoverReportLine.create({
        period: '2026-08',
        categoryId: 1,
        warehouseId: 10,
        outcome: GoodsFlowMetric.create(1, 100),
        stock: GoodsFlowMetric.create(2, 200),
    });
    line.calcRatio(null);
    return line;
}

function buildEvent(
    direction: 'service' | 'shop',
): AccountingPeriodClosedDomainEvent {
    return withRequestContext(
        () =>
            new AccountingPeriodClosedDomainEvent({
                aggregateId: 'period-1',
                direction,
                period: '2026-08',
                closedBy: 7,
                employeeCount: 3,
            }),
    );
}

describe('CloseGoodsTurnoverPeriod', () => {
    const buildHandler = (build: jest.Mock, replaceAll: jest.Mock) =>
        new CloseGoodsTurnoverPeriod(
            { build } as unknown as BuildGoodsTurnoverReportService,
            {
                replaceAll,
            } as unknown as GoodsTurnoverReportLineRepositoryPort,
        );

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('direction=service — делает финальный пересчёт и сохраняет строки как снэпшот', async () => {
        const line = buildLine();
        const build = jest.fn().mockResolvedValue(
            GoodsTurnoverReport.create({
                period: '2026-08',
                lines: [line],
            }),
        );
        const replaceAll = jest.fn().mockResolvedValue(undefined);
        const handler = buildHandler(build, replaceAll);
        const event = buildEvent('service');

        await handler.handle(event);

        expect(build).toHaveBeenCalledWith('2026-08');
        expect(replaceAll).toHaveBeenCalledWith('2026-08', [line]);
    });

    it('direction=shop — игнорируется, не строит и не сохраняет отчёт', async () => {
        const build = jest.fn();
        const replaceAll = jest.fn();
        const handler = buildHandler(build, replaceAll);
        const event = buildEvent('shop');

        await handler.handle(event);

        expect(build).not.toHaveBeenCalled();
        expect(replaceAll).not.toHaveBeenCalled();
    });

    it('не выбрасывает исключение при ошибке финального пересчёта — только логирует', async () => {
        const errorSpy = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation();
        const build = jest.fn().mockRejectedValue(new Error('erp down'));
        const replaceAll = jest.fn();
        const handler = buildHandler(build, replaceAll);
        const event = buildEvent('service');

        await expect(handler.handle(event)).resolves.toBeUndefined();
        expect(replaceAll).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
    });
});
