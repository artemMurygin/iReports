import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { BitrixModule } from './integrations/bitrix/bitrix.module';
import { DealsModule } from './deals/deals.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    DatabaseModule,
    BitrixModule,
    DealsModule,
    ScheduleModule.forRoot(),
    CronModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
