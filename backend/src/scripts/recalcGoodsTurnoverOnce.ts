import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../infrustructure/database/database.module';
import { WarehouseModule } from '../domains/service/modules/warehouse/warehouse.module';
import { runInSystemRequestContext } from '../shared/application/context/run-in-system-context';
import { BuildGoodsTurnoverReportService } from '../domains/service/modules/warehouse/application/services/build-goods-turnover-report.service';
import {
    GOODS_TURNOVER_REPORT_LINE_REPOSITORY,
    GoodsTurnoverReportLineRepositoryPort,
} from '../domains/service/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report-line.port';

// Ручной пересчёт отчёта по оборачиваемости за один месяц — то же самое,
// что сделал бы RecalculateOpenGoodsTurnoverPeriodCron на ближайшем часовом
// тике, или CloseGoodsTurnoverPeriod при закрытии месяца. Минимальный модуль
// вместо полного AppModule (тот падает в этой песочнице на несвязанной
// зависимости AiHttpService/OPENAI_API_KEY). Ограничение глубины категорий
// по складу (основной склад — корень+дети, остальные — только корень)
// встроено в прод-код (GoodsTurnoverWarehouseScope, warehouse.module.ts) —
// подменять провайдеры здесь больше не нужно, используется обычный DI
// WarehouseModule.
//
// Запуск: npm run build && node dist/src/scripts/recalcGoodsTurnoverOnce.js <период, например 2026-07>
@Module({ imports: [EventEmitterModule.forRoot(), DatabaseModule, WarehouseModule] })
class RecalcOnceModule {}

async function main() {
    const period = process.argv[2];
    if (!period) {
        console.error(
            'Usage: node recalcGoodsTurnoverOnce.js <period, e.g. 2026-07>',
        );
        process.exit(1);
    }

    const moduleRef = await Test.createTestingModule({
        imports: [RecalcOnceModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const buildService = app.get(BuildGoodsTurnoverReportService);
    const lineRepository = app.get<GoodsTurnoverReportLineRepositoryPort>(
        GOODS_TURNOVER_REPORT_LINE_REPOSITORY,
    );

    await runInSystemRequestContext(async () => {
        const report = await buildService.build(period);
        await lineRepository.replaceAll(period, report.lines);
        console.log(
            `OK: оборачиваемость за ${period} пересчитана: ${report.lines.length} строк`,
        );
    });

    await app.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
