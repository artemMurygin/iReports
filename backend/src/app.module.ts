import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerMiddleware } from './shared/logger.middleware';
import { DatabaseModule } from './infrustructure/database/database.module';
import { BitrixModule } from './integrations/bitrix/bitrix.module';
import { AiModule } from './integrations/ai/ai.module';
import { GoogleSheetsModule } from './integrations/google-sheets/google-sheets.module';
import { RoappModule } from './domains/service/integrations/roapp/roapp.module';
import { CustomApiRoappModule } from './domains/service/integrations/custom-api-roapp/custom-api-roapp.module';
import { MoyskladModule } from './domains/shop/integrations/moySklad/moysklad.module';
import { BitrixSyncModule } from './sync/bitrix/bitrix-sync.module';
import { SalesModule } from './domains/service/modules/sales/sales.module';
import { RoappSyncModule } from './domains/service/sync/roapp/roapp-sync.module';
import { MoySkladSyncModule } from './domains/shop/sync/moySklad/moysklad-sync.module';

// TODO: временно перенесены как есть, требуют рефакторинга под DDD:
import { PriceMonitoringModule } from './TODO/priceMonitoring/priceMonitoring.module';
import { DealsModule } from './TODO/deals/deals.module';
import { ReportsModule } from './TODO/reports/reports.module';

// TODO: не мигрировано в src1 (эквивалента ещё нет):
// import { CronModule } from './cron/cron.module';
// import { SalaryModule } from './salary/salary.module';

@Module({
  imports: [
    DatabaseModule,
    BitrixModule,
    RoappModule,
    CustomApiRoappModule,
    ScheduleModule.forRoot(),
    BitrixSyncModule,
    RoappSyncModule,
    SalesModule,
    AiModule,
    GoogleSheetsModule,
    MoyskladModule,
    MoySkladSyncModule,

    // TODO: временно перенесены как есть, требуют рефакторинга под DDD:
    PriceMonitoringModule,
    DealsModule,
    ReportsModule,

    // TODO: не мигрировано в src1 (эквивалента ещё нет):
    // CronModule,
    // SalaryModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
