import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RequestContextMiddleware } from 'nestjs-request-context';
import { LoggerMiddleware } from './shared/logger.middleware';
import { ContextInterceptor } from './shared/application/context/ContextInterceptor';
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
import { ShopSalesModule } from './domains/shop/modules/sales/shop-sales.module';
import { AccountingModule } from './domains/service/modules/accounting/accounting.module';
import { ShopAccountingModule } from './domains/shop/modules/accounting/shop-accounting.module';
import { ShopWarehouseModule } from './domains/shop/modules/warehouse/shop-warehouse.module';
import { EmployeeIdentityModule } from './modules/employee-identity/employee-identity.module';

// TODO: временно перенесены как есть, требуют рефакторинга под DDD:
import { PriceMonitoringModule } from './TODO/priceMonitoring/priceMonitoring.module';
import { DealsModule } from './TODO/deals/deals.module';
import { ReportsModule } from './TODO/reports/reports.module';

@Module({
    imports: [
        DatabaseModule,
        BitrixModule,
        RoappModule,
        CustomApiRoappModule,
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
        BitrixSyncModule,
        RoappSyncModule,
        SalesModule,
        ShopSalesModule,
        AccountingModule,
        ShopAccountingModule,
        ShopWarehouseModule,
        EmployeeIdentityModule,
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
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: ContextInterceptor,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // RequestContextMiddleware должен отработать первым, чтобы
        // AsyncLocalStorage-контекст был доступен во всех последующих
        // middleware/interceptors/controllers этого запроса.
        consumer
            .apply(RequestContextMiddleware, LoggerMiddleware)
            .forRoutes('*');
    }
}
