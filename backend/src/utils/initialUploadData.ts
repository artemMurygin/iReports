import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BitrixSyncService } from '../sync/bitrix/bitrix.service';
import { UploadLogger } from './logger';
import { RoappSyncService } from '../sync/roapp/roapp.service';
import { CustomApiRoappSyncService } from '../sync/custom-api-roapp/custom-api-roapp.service';

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
  const customRoApp = app.get(CustomApiRoappSyncService);

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

    if (erp.includes('R')) {
      await roapp.uploadEmployees();
      await roapp.uploadMarketingSources();
      await roapp.uploadOrderStatuses();
      await roapp.uploadOrderTypes();
      await roapp.uploadProductCategories();
      await roapp.uploadServiceCategories();
      await roapp.uploadServices();
      await roapp.uploadProducts();
      await customRoApp.uploadServicesBonuses();
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
