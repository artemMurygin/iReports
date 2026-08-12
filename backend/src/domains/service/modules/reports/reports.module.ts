import { Module } from '@nestjs/common';
import { SERVICE_SALES_SOURCE } from './application/ports/service-sales.port';
import { ServiceSalesRepository } from './infrastructure/repositories/service-sales.repository';
import { GetServicesAnalyticsService } from './application/services/get-services-analytics.service';
import { ListServiceCategoriesService } from './application/services/list-service-categories.service';
import { GetServicesAnalyticsHttpController } from './interface/http-controllers/get-services-analytics.http.controller';
import { ListServiceCategoriesHttpController } from './interface/http-controllers/list-service-categories.http.controller';

// Модуль reports (Фаза 5, docs/todo-modules-ddd-refactoring/
// plan-todo-modules-ddd-refactoring.md) — новый дом для аналитики продаж
// услуг и справочника категорий услуг из src/TODO/reports (удалён этой же
// фазой целиком). В отличие от воронки сервисных сделок (Фаза 4, осталась
// в modules/sales — источник данных bitrix_deals), этот модуль читает
// roapp_service_orders/roapp_service_categories и с воронкой по данным не
// пересекается (см. PRD, "TODO/reports режется по источнику данных на две
// части").
@Module({
    controllers: [
        GetServicesAnalyticsHttpController,
        ListServiceCategoriesHttpController,
    ],
    providers: [
        { provide: SERVICE_SALES_SOURCE, useClass: ServiceSalesRepository },
        GetServicesAnalyticsService,
        ListServiceCategoriesService,
    ],
})
export class ReportsModule {}
