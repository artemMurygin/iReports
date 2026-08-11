// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории.
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { ShopSalesPlanAutoCreationCron } from './shop-sales-plan-auto-creation.cron';
import type { EnsureSalesPlansForPeriodService } from '@/domains/service/modules/sales/application/services/ensure-sales-plans-for-period.service';
import { logCronError } from '@/shared/cron/cron-file-logger';

describe('ShopSalesPlanAutoCreationCron', () => {
    const buildCron = (ensure: jest.Mock) =>
        new ShopSalesPlanAutoCreationCron({
            ensure,
        } as unknown as EnsureSalesPlansForPeriodService);

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('достраивает план текущего периода (UTC) для направления shop', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-01T00:00:00.000Z'),
        );
        const ensure = jest.fn().mockResolvedValue([]);
        const cron = buildCron(ensure);

        await cron.run();

        expect(ensure).toHaveBeenCalledWith('shop', '2026-09');
    });

    // Идемпотентность самого достраивания (issue #56 — "автосоздание планов
    // магазина идемпотентно") уже покрыта на уровне EnsureSalesPlansForPeriodService,
    // общей для service и shop (см. ensure-sales-plans-for-period.service.spec.ts,
    // "не создаёт дублей и не трогает APPROVED/MANUAL строки при повторном
    // запуске") — здесь достаточно убедиться, что повторный запуск крона
    // просто вызывает ту же идемпотентную операцию ещё раз, не дублируя
    // побочных эффектов самого крона (логирование, обработка ошибок).
    it('повторный запуск идемпотентен — просто вызывает ensure ещё раз, без побочных эффектов крона', async () => {
        const ensure = jest.fn().mockResolvedValue([]);
        const cron = buildCron(ensure);

        await cron.run();
        await cron.run();

        expect(ensure).toHaveBeenCalledTimes(2);
        expect(ensure).toHaveBeenNthCalledWith(1, 'shop', expect.any(String));
        expect(ensure).toHaveBeenNthCalledWith(2, 'shop', expect.any(String));
    });

    it('не выбрасывает исключение при ошибке достраивания — только логирует', async () => {
        const ensure = jest.fn().mockRejectedValue(new Error('db down'));
        const cron = buildCron(ensure);

        await expect(cron.run()).resolves.toBeUndefined();
        expect(logCronError).toHaveBeenCalledWith(
            'ShopSalesPlanAutoCreationCron.run',
            expect.any(Error),
            expect.objectContaining({ period: expect.any(String) }),
        );
    });
});
