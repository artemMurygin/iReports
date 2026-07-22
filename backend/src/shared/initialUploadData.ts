import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BitrixSyncService } from '../sync/bitrix/bitrix-sync.service';
import { UploadLogger } from './logger';
import { RoappSyncService } from '../domains/service/sync/roapp/roapp-sync.service';
import { MoySkladSyncService } from '../domains/shop/sync/moySklad/moysklad-sync.service';

async function bootstrap() {
  const dateArg = process.argv[2];
  const erp = process.argv[3];

  if (!dateArg) {
    console.error('Usage: npm run initial -- <date> (e.g. 2025-01-01)');
    process.exit(1);
  }

  const fromDate = new Date(dateArg);
  if (isNaN(fromDate.getTime())) {
    console.error(`Invalid date: "${dateArg}". Use format YYYY-MM-DD`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const bitrix = app.get(BitrixSyncService);
  const roapp = app.get(RoappSyncService);
  const moySklad = app.get(MoySkladSyncService);

  const log = new UploadLogger('Инициализация данных');
  try {
    if (erp.includes('B')) {
      await bitrix.uploadEmployees();
      await bitrix.uploadStages();
      await bitrix.uploadDeviceTypes();
      await bitrix.uploadLeadSources();
      await bitrix.uploadEnums();
      await bitrix.uploadSources();
      await bitrix.uploadCreatedDeals(fromDate);
    }

    if (erp.includes('M')) {
      await moySklad.uploadEmployees();
      await moySklad.uploadProductFolders();
      await moySklad.uploadProducts();
      await moySklad.uploadServices();
      await moySklad.uploadCreatedDemands(fromDate);
    }

    if (erp.includes('R')) {
      // await roapp.uploadEmployees();
      // await roapp.uploadMarketingSources();
      // await roapp.uploadOrderStatuses();
      // await roapp.uploadOrderTypes();
      // await roapp.uploadProductCategories();
      // await roapp.uploadServiceCategories();
      // await roapp.uploadServices();
      // await roapp.uploadProducts();
      // await roapp.uploadServiceBonuses();
      const ordersIds = await roapp.uploadCreatedOrders(fromDate);
      await roapp.uploadOrderItems(ordersIds);
    }

    await app.close();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
