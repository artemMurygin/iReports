import { GetGoodsTurnoverReportHttpController } from './get-goods-turnover-report.http.controller';
import { GetGoodsTurnoverReportService } from '../../application/services/goods-turnover-report/get-goods-turnover-report.service';
import type { GoodsTurnoverReportLineDto } from '../../application/mappers/goods-turnover-report/to-goods-turnover-report-response';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('GetGoodsTurnoverReportHttpController', () => {
    const line: GoodsTurnoverReportLineDto = {
        categoryId: 'folder-1',
        warehouseId: 'warehouse-1',
        turnoverQuantity: 5,
        turnoverSum: 10_000,
        stockQuantity: 3,
        stockSum: 6_000,
        coefficient: null,
    };

    it('парсит :period в Period и делегирует сервису, не подставляя warehouseId, когда его нет в query', async () => {
        const getReport = jest.fn().mockResolvedValue([line]);
        const service = {
            getReport,
        } as unknown as GetGoodsTurnoverReportService;
        const controller = new GetGoodsTurnoverReportHttpController(service);

        const result = await controller.get('2026-08', {
            warehouseId: undefined,
        });

        expect(getReport).toHaveBeenCalledTimes(1);
        const [periodArg, warehouseIdArg] = getReport.mock.calls[0] as [
            { getValue: () => string },
            string | undefined,
        ];
        expect(periodArg.getValue()).toBe('2026-08');
        expect(warehouseIdArg).toBeUndefined();
        expect(result).toEqual([line]);
    });

    it('пробрасывает warehouseId из query в сервис', async () => {
        const getReport = jest.fn().mockResolvedValue([line]);
        const service = {
            getReport,
        } as unknown as GetGoodsTurnoverReportService;
        const controller = new GetGoodsTurnoverReportHttpController(service);

        await controller.get('2026-08', { warehouseId: 'warehouse-1' });

        const [, warehouseIdArg] = getReport.mock.calls[0] as [
            unknown,
            string | undefined,
        ];
        expect(warehouseIdArg).toBe('warehouse-1');
    });

    it('бросает ArgumentInvalidException на невалидный формат периода (не YYYY-MM)', async () => {
        const service = {
            getReport: jest.fn(),
        } as unknown as GetGoodsTurnoverReportService;
        const controller = new GetGoodsTurnoverReportHttpController(service);

        await expect(
            withRequestContext(() =>
                controller.get('2026', { warehouseId: undefined }),
            ),
        ).rejects.toThrow(ArgumentInvalidException);
    });
});
