// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории.
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { RecalculateOpenGoodsTurnoverPeriodCron } from './recalculate-open-goods-turnover-period.cron';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '../../application/ports/goods-turnover-report/goods-turnover-report-line.port';
import type { BuildGoodsTurnoverReportService } from '../../application/services/build-goods-turnover-report.service';
import { GoodsTurnoverReport } from '../../domain/entities/goods-turnover-report/goods-turnover-report.entity';
import { GoodsTurnoverReportLine } from '../../domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '../../domain/value-objects/goods-flow-metric.value-object';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { logCronError } from '@/shared/cron/cron-file-logger';
import { withRequestContext } from '@/shared/testing/with-request-context';

function buildLine(): GoodsTurnoverReportLine {
    const line = GoodsTurnoverReportLine.create({
        period: '2026-09',
        categoryId: 1,
        warehouseId: 10,
        outcome: GoodsFlowMetric.create(1, 100),
        stock: GoodsFlowMetric.create(2, 200),
    });
    line.calcRatio(null);
    return line;
}

describe('RecalculateOpenGoodsTurnoverPeriodCron', () => {
    const buildCron = (
        findByDirectionAndPeriod: jest.Mock,
        build: jest.Mock,
        replaceAll: jest.Mock,
    ) =>
        new RecalculateOpenGoodsTurnoverPeriodCron(
            {
                findByDirectionAndPeriod,
            } as unknown as AccountingPeriodRepositoryPort,
            { build } as unknown as BuildGoodsTurnoverReportService,
            { replaceAll } as unknown as GoodsTurnoverReportLineRepositoryPort,
        );

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('нет записи AccountingPeriod для периода — пересчитывает (трактуется как OPEN)', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const findByDirectionAndPeriod = jest.fn().mockResolvedValue(null);
        const line = buildLine();
        const build = jest.fn().mockResolvedValue(
            GoodsTurnoverReport.create({
                period: '2026-09',
                lines: [line],
            }),
        );
        const replaceAll = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(findByDirectionAndPeriod, build, replaceAll);

        await cron.run();

        expect(findByDirectionAndPeriod).toHaveBeenCalledWith(
            'service',
            '2026-09',
        );
        expect(build).toHaveBeenCalledWith('2026-09');
        expect(replaceAll).toHaveBeenCalledWith('2026-09', [line]);
    });

    it('AccountingPeriod открыт — пересчитывает', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const openPeriod = withRequestContext(() =>
            AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-09',
            }),
        );
        const findByDirectionAndPeriod = jest
            .fn()
            .mockResolvedValue(openPeriod);
        const build = jest
            .fn()
            .mockResolvedValue(
                GoodsTurnoverReport.create({ period: '2026-09', lines: [] }),
            );
        const replaceAll = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(findByDirectionAndPeriod, build, replaceAll);

        await cron.run();

        expect(build).toHaveBeenCalledWith('2026-09');
        expect(replaceAll).toHaveBeenCalledWith('2026-09', []);
    });

    it('AccountingPeriod закрыт — пропускает пересчёт', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const closedPeriod = withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-09',
            });
            period.close(1, 0);
            return period;
        });
        const findByDirectionAndPeriod = jest
            .fn()
            .mockResolvedValue(closedPeriod);
        const build = jest.fn();
        const replaceAll = jest.fn();
        const cron = buildCron(findByDirectionAndPeriod, build, replaceAll);

        await cron.run();

        expect(build).not.toHaveBeenCalled();
        expect(replaceAll).not.toHaveBeenCalled();
    });

    it('продолжает при частичном успехе построения (сбой одной пары уже обработан внутри BuildGoodsTurnoverReportService)', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const findByDirectionAndPeriod = jest.fn().mockResolvedValue(null);
        const line = buildLine();
        // Одна пара категория-склад пропущена внутри build() (design.md D6)
        // — отчёт всё равно строится с оставшимися строками, крон не должен
        // считать это ошибкой.
        const build = jest.fn().mockResolvedValue(
            GoodsTurnoverReport.create({
                period: '2026-09',
                lines: [line],
            }),
        );
        const replaceAll = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(findByDirectionAndPeriod, build, replaceAll);

        await expect(cron.run()).resolves.toBeUndefined();
        expect(replaceAll).toHaveBeenCalledWith('2026-09', [line]);
        expect(logCronError).not.toHaveBeenCalled();
    });

    it('не выбрасывает исключение при ошибке пересчёта целиком — только логирует', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const findByDirectionAndPeriod = jest
            .fn()
            .mockRejectedValue(new Error('db down'));
        const build = jest.fn();
        const replaceAll = jest.fn();
        const cron = buildCron(findByDirectionAndPeriod, build, replaceAll);

        await expect(cron.run()).resolves.toBeUndefined();
        expect(logCronError).toHaveBeenCalledWith(
            'RecalculateOpenGoodsTurnoverPeriodCron.run',
            expect.any(Error),
            expect.objectContaining<{ period: string }>({
                period: expect.any(String) as string,
            }),
        );
    });
});
