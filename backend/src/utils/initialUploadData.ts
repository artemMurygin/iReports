import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DealsService } from '../deals/deals.service';

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
  const dealsService = app.get(DealsService);
  await dealsService.uploadInitBitrixData();

  await dealsService.uploadCreatedDeals(fromDate);

  await app.close();
}

bootstrap();
