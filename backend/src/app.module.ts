import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RequestContextMiddleware } from 'nestjs-request-context';
import { LoggerMiddleware } from './shared/logger.middleware';
import { ContextInterceptor } from './shared/application/context/ContextInterceptor';
import { DatabaseModule } from './infrustructure/database/database.module';
import { RedisModule } from './infrustructure/redis/redis.module';
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
import { ShopSalesModule } from './domains/shop/modules/sales/sales.module';
import { AccountingModule } from './domains/service/modules/accounting/accounting.module';
import { ShopAccountingModule } from './domains/shop/modules/accounting/accounting.module';
import { ShopWarehouseModule } from './domains/shop/modules/warehouse/warehouse.module';
import { EmployeeIdentityModule } from './modules/employee-identity/employee-identity.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { WorkScheduleModule } from './modules/work-schedule/work-schedule.module';
import { EmployeeBalanceModule } from './modules/employee-balance/employee-balance.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionModule } from './modules/session/session.module';
import { RolesModule } from './modules/roles/roles.module';
import { SessionAuthGuard } from './modules/session/interface/session-auth.guard';
import { CsrfGuard } from './modules/session/interface/csrf.guard';
import { PermissionsGuard } from './modules/roles/interface/permissions.guard';
// Аналитика услуг и категории услуг (Фаза 5,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// новый дом для src/TODO/reports, удалённого этой же фазой целиком.
import { ReportsModule } from './domains/service/modules/reports/reports.module';
import { PricingModule } from './domains/service/modules/marketing/pricing/pricing.module';
import { ShopPricingModule } from './domains/shop/modules/marketing/pricing/pricing.module';

@Module({
    imports: [
        DatabaseModule,
        RedisModule,
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
        DirectoryModule,
        WorkScheduleModule,
        EmployeeBalanceModule,
        AuthModule,
        SessionModule,
        RolesModule,
        ReportsModule,
        PricingModule,
        ShopPricingModule,
        AiModule,
        GoogleSheetsModule,
        MoyskladModule,
        MoySkladSyncModule,

        // TODO: не мигрировано в src1 (эквивалента ещё нет):
        // CronModule,
        // SalaryModule,
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: ContextInterceptor,
        },
        // add-bitrix24-auth-and-rbac (design.md, Decision 5 + Migration Plan
        // шаг 6-7, раздел 24 tasks.md): SessionAuthGuard/CsrfGuard/
        // PermissionsGuard теперь зарегистрированы глобально — включение
        // делает систему "закрыто по умолчанию" для КАЖДОГО роута
        // приложения, не размеченного `@Public()`. Порядок в массиве —
        // порядок выполнения (SessionAuthGuard первым заполняет
        // `request.user`, CsrfGuard и PermissionsGuard читают его дальше;
        // PermissionsGuard последним — permissions уже проверяются против
        // заполненного `request.user`). Раздел 20 tasks.md (весь frontend
        // ходит через сессию, включая `/admin/roles`) реализован, откладывать
        // включение больше не нужно.
        //
        // ВАЖНО (раздел 24.2 tasks.md, задокументировано, не исправлено
        // самостоятельно — см. финальный отчёт этой секции): `POST
        // /bitrix/install` (`backend/src/integrations/bitrix/
        // bitrix.controller.ts`) — вызывается САМИМ Bitrix24 при установке/
        // переустановке приложения (см. JSDoc метода), не может нести
        // валидную сессию iReports и НЕ размечен `@Public()`. С этим
        // глобальным включением этот роут возвращает 401 вместо успешной
        // установки. Не исправлено в рамках этой задачи: правки
        // `backend/src/integrations/bitrix/**` явно вне мандата агента,
        // выполнявшего раздел 24 (инструкция "не трогай
        // backend/src/integrations/bitrix/**").
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
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
