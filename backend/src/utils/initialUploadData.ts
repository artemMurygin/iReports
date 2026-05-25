import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BitrixSyncService } from '../sync/bitrix/bitrix.service';
import { UploadLogger } from './logger';
import { RoappSyncModule } from '../sync/roapp/roapp.module';
import { RoappSyncService } from '../sync/roapp/roapp.service';
import { CustomApiRoappSyncService } from '../sync/custom-api-roapp/custom-api-roapp.service';

async function bootstrap() {
  const dateArg = process.argv[2];
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
  // const roapp = app.get(RoappSyncService);
  // const customRoApp = app.get(CustomApiRoappSyncService);

  const log = new UploadLogger('Инициализация данных Bitrix');
  try {
    log.start();
    log.tick(await bitrix.uploadEmployees());
    log.tick(await bitrix.uploadStages());
    log.tick(await bitrix.uploadDeviceTypes());
    log.tick(await bitrix.uploadLeadSources());
    log.tick(await bitrix.uploadEnums());
    log.tick(await bitrix.uploadSources());
    log.done();
  } catch (error) {
    log.error(error);
    throw new Error();
  }

  // await bitrix.uploadCreatedDeals(fromDate);
  // await roapp.uploadEmployees();
  // await roapp.uploadMarketingSources();
  // await roapp.uploadOrderStatuses();
  // await roapp.uploadOrderTypes();
  // await roapp.uploadProductCategories();
  // await roapp.uploadServiceCategories();
  // await roapp.uploadServices();
  // await roapp.uploadProducts();
  // await customRoApp.uploadServicesBonuses();
  await app.close();
}

bootstrap();
