import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PriceMonitoringService } from '../priceMonitoring/priceMonitoring.service';

async function bootstrap() {
  // const filePath = path.join(
  //   process.cwd(),
  //   'src',
  //   'priceMonitoring',
  //   'Прайс ТрейдМи 13.05.2026.xlsx',
  // );
  //
  // if (!fs.existsSync(filePath)) {
  //   console.error(`Файл не найден: ${filePath}`);
  //   process.exit(1);
  // }
  //
  // const fileBase64 = fs.readFileSync(filePath).toString('base64');
  // console.log(`Файл загружен: ${path.basename(filePath)}`);
  //
  // const app = await NestFactory.createApplicationContext(AppModule);
  // const priceMonitoring = app.get(PriceMonitoringService);
  //
  // console.log('Запуск сопоставления...');
  // const results = await priceMonitoring.updateShopProductsCosts(fileBase64);
  //
  // await app.close();
}

bootstrap();
