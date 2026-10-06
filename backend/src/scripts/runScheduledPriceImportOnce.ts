import 'dotenv/config';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { RedisModule } from '../infrustructure/redis/redis.module';
import { ShopPricingModule } from '../domains/shop/modules/marketing/pricing/pricing.module';
import { RunScheduledPriceImportService } from '../domains/shop/modules/marketing/pricing/application/services/run-scheduled-price-import.service';
import { runInSystemRequestContext } from '../shared/application/context/run-in-system-context';

// Разовый ручной запуск автоматической выгрузки прайса магазина (то же, что делает
// ScheduledPriceImportCron в будни в 12:00), чтобы не ждать крон при проверке.
// ВНИМАНИЕ: запуск РЕАЛЬНЫЙ — он обновляет закупочные цены в МойСклад и таблице Sheets и шлёт
// уведомление в Telegram. Если название файла в папке Drive не изменилось с прошлой успешной
// выгрузки (ключ Redis `price-import:schedule:last-file-name`), импорт не запустится — придёт
// сообщение «прайс не изменился».
//
// Запуск на сервере (env и Redis уже настроены):
//   docker compose exec backend node dist/src/scripts/runScheduledPriceImportOnce.js
// Локально: npm run price:import:scheduled (нужны env из .env и доступный Redis).
@Module({
    imports: [CqrsModule.forRoot(), RedisModule, ShopPricingModule],
})
class RunScheduledPriceImportOnceModule {}

async function main() {
    const moduleRef = await Test.createTestingModule({
        imports: [RunScheduledPriceImportOnceModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const service = app.get(RunScheduledPriceImportService);
    const outcome = await runInSystemRequestContext(() => service.run());
    console.log(
        `Итог: ${outcome.getKind()}${outcome.getReason() ? ` (${outcome.getReason()})` : ''}`,
    );

    await app.close();
    // ioredis держит соединение — завершаем процесс явно
    process.exit(outcome.getKind() === 'failed' ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
