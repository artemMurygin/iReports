import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DealsService } from '../deals/deals.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dealsService = app.get(DealsService);
  await dealsService.uploadInitBitrixData();

  const fromDate = new Date('2025-01-01');
  await dealsService.uploadCreatedDeals(fromDate);

  await app.close();
}

bootstrap();
