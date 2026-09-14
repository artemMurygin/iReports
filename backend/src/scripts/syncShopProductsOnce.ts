import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../infrustructure/database/database.module';
import { MoySkladSyncModule } from '../domains/shop/sync/moySklad/moysklad-sync.module';
import { MoySkladSyncService } from '../domains/shop/sync/moySklad/moysklad-sync.service';
import { runInSystemRequestContext } from '../shared/application/context/run-in-system-context';

// Разовый бэкфилл MoySkladProduct.onlinePurchaserId/offlinePurchaserId —
// ENABLE_CRON=false в dev, поэтому MoySkladCatalogsSyncCron (который бы
// сам подтянул эти поля при обычном почасовом тике) не тикает сам по
// себе. Только uploadProducts() — остальные каталоги (сотрудники, папки,
// услуги, склады) уже синканы и не менялись этим фиксом.
//
// Запуск: npm run build && node dist/src/scripts/syncShopProductsOnce.js
@Module({
    imports: [EventEmitterModule.forRoot(), DatabaseModule, MoySkladSyncModule],
})
class SyncShopProductsOnceModule {}

async function main() {
    const moduleRef = await Test.createTestingModule({
        imports: [SyncShopProductsOnceModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const syncService = app.get(MoySkladSyncService);

    await runInSystemRequestContext(async () => {
        await syncService.uploadProducts();
    });

    await app.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
