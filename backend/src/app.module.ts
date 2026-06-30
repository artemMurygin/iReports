import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { BitrixModule } from './integrations/bitrix/bitrix.module';
import { DealsModule } from './deals/deals.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { ReportsModule } from './reports/reports.module';
import { BitrixSyncModule } from './sync/bitrix/bitrix.module';
import { RoappSyncModule } from './sync/roapp/roapp.module';
import { RoappModule } from './integrations/roapp/roapp.module';
import { CustomApiRoappSyncModule } from './sync/custom-api-roapp/custom-api-roapp.module';
import { PriceMonitoringModule } from './priceMonitoring/priceMonitoring.module';
import { AiModule } from './integrations/ai/ai.module';
import { GoogleSheetsModule } from './integrations/google-sheets/google-sheets.module';
import { MoyskladModule } from './integrations/moySklad/moysklad.module';
import { MoySkladSyncModule } from './sync/moySklad/moySklad.module';

@Module({
  imports: [
    DatabaseModule,
    BitrixModule,
    RoappModule,
    DealsModule,
    ScheduleModule.forRoot(),
    CronModule,
    ReportsModule,
    BitrixSyncModule,
    RoappSyncModule,
    CustomApiRoappSyncModule,
    PriceMonitoringModule,
    AiModule,
    GoogleSheetsModule,
    MoyskladModule,
    MoySkladSyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
