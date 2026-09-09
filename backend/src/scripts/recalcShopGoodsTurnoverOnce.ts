import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../infrustructure/database/database.module';
import { ShopWarehouseModule } from '../domains/shop/modules/warehouse/warehouse.module';
import { MoySkladSyncService } from '../domains/shop/sync/moySklad/moysklad-sync.service';
import { RebuildGoodsTurnoverReportService } from '../domains/shop/modules/warehouse/application/services/goods-turnover-report/rebuild-goods-turnover-report.service';
import { Period } from '../shared/domain/period.value-object';
import { runInSystemRequestContext } from '../shared/application/context/run-in-system-context';

// Разовый бэкфилл + пересчёт отчёта по оборачиваемости магазина за
// прошедшие периоды (см. GoodsTurnoverReportCron, который пересчитывает
// только текущий открытый месяц — для уже закрытых прошлых месяцев нужен
// ручной прогон, аналог recalcGoodsTurnoverOnce.ts у service-направления).
//
// Делает три вещи по порядку для каждого периода:
// 1) uploadDemandsByMoment(from, to) — дозаполняет storeId у уже
//    засинканных MoySkladDemand за месяц (колонка добавлена этой миграцией
//    позже первичного синка, у старых строк storeId = null).
// 2) backfillHistoricalStockSnapshots — создаёт помесячные снимки остатков
//    (MoySkladStock) на конец каждого месяца от fromDate до текущего.
// 3) RebuildGoodsTurnoverReportService.rebuild(period) — пересчитывает и
//    полностью заменяет строки отчёта за период.
//
// Запуск: npm run build && node dist/src/scripts/recalcShopGoodsTurnoverOnce.js 2026-06 2026-07
@Module({
    imports: [EventEmitterModule.forRoot(), DatabaseModule, ShopWarehouseModule],
})
class RecalcShopOnceModule {}

function periodBounds(period: string): { from: Date; to: Date } {
    return Period.create(period).getBounds();
}

async function main() {
    const periods = process.argv.slice(2);
    if (periods.length === 0) {
        console.error(
            'Usage: node recalcShopGoodsTurnoverOnce.js <period, e.g. 2026-06> [<period2> ...]',
        );
        process.exit(1);
    }

    const moduleRef = await Test.createTestingModule({
        imports: [RecalcShopOnceModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const syncService = app.get(MoySkladSyncService);
    const rebuildReport = app.get(RebuildGoodsTurnoverReportService);

    await runInSystemRequestContext(async () => {
        const sortedPeriods = [...periods].sort();
        const earliest = periodBounds(sortedPeriods[0]).from;

        for (const period of periods) {
            const { from, to } = periodBounds(period);
            console.log(
                `[${period}] Синк отгрузок по moment (${from.toISOString()}..${to.toISOString()})...`,
            );
            await syncService.uploadDemandsByMoment(from, to);
        }

        console.log(
            `Бэкфилл истории остатков от ${earliest.toISOString()}...`,
        );
        await syncService.backfillHistoricalStockSnapshots(earliest);

        for (const period of periods) {
            const parsedPeriod = Period.create(period);
            await rebuildReport.rebuild(parsedPeriod);
            console.log(`OK: отчёт по оборачиваемости магазина за ${period} пересчитан`);
        }
    });

    await app.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
