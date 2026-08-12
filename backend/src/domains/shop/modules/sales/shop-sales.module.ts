import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import { SalesPlanRepository } from '@/domains/service/modules/sales/infrastructure/repositories/sales-plan.repository';
import { SalesPlanTemplateRepository } from '@/domains/service/modules/sales/infrastructure/repositories/sales-plan-template.repository';
import { EnsureSalesPlansForPeriodService } from '@/domains/service/modules/sales/application/services/ensure-sales-plans-for-period.service';
import { ListSalesPlansService } from '@/domains/service/modules/sales/application/services/list-sales-plans.service';
import { ListSalesPlanTemplatesService } from '@/domains/service/modules/sales/application/services/list-sales-plan-templates.service';
import { SHOP_SALES_FACT_SOURCE } from './application/ports/shop-sales-fact-source.port';
import { MoySkladSalesFactSourceRepository } from './infrastructure/repositories/moysklad-sales-fact-source.repository';
import { SHOP_SALES_PERFORMANCE_READER } from './application/ports/shop-sales-performance.port';
import { GetShopSalesPerformanceService } from './application/services/get-shop-sales-performance.service';
import { ShopSalesPlanAutoCreationCron } from './infrastructure/cron/shop-sales-plan-auto-creation.cron';
import { ListShopSalesPerformanceHttpController } from './interface/http-controllers/list-shop-sales-performance.http.controller';
import { CreateShopSalesPlanHttpController } from './interface/http-controllers/create-shop-sales-plan.http.controller';
import { UpdateShopSalesPlanHttpController } from './interface/http-controllers/update-shop-sales-plan.http.controller';
import { DeleteShopSalesPlanHttpController } from './interface/http-controllers/delete-shop-sales-plan.http.controller';
import { ApproveShopSalesPlanHttpController } from './interface/http-controllers/approve-shop-sales-plan.http.controller';
import { ListShopSalesPlansHttpController } from './interface/http-controllers/list-shop-sales-plans.http.controller';
import { ListShopSalesPlanTemplatesHttpController } from './interface/http-controllers/list-shop-sales-plan-templates.http.controller';
import { PutShopSalesPlanTemplateHttpController } from './interface/http-controllers/put-shop-sales-plan-template.http.controller';

// План/шаблон плана продаж (SalesPlan/SalesPlanTemplate) для shop теперь
// обслуживается собственным CRUD этого модуля (POST|GET|PATCH|DELETE
// /v1/shop/sales/plan, GET|PUT /v1/shop/sales/plan_template, POST
// /v1/shop/sales/plan/approve, см. interface/http-controllers/*-shop-sales-
// plan*.http.controller.ts) — но не дублированием бизнес-логики, а тонким
// HTTP-слоем поверх той же команды/сервиса, что и у направления service
// (SalesPlan/SalesPlanTemplate — общие Prisma-модели с полем direction, см.
// sales.prisma, без ERP-специфичной логики): контроллеры этого модуля
// подставляют direction: 'shop' сами (не читают его из тела/query) и
// диспатчат те же классы команд (CreateSalesPlanCommand и т.д.) из
// domains/service/modules/sales/application/command/*, что и SalesModule.
// Обработчики этих команд уже зарегистрированы SalesModule на общем
// (шаренном между всеми модулями приложения, т.к. CqrsModule — тот же
// класс, импортированный и там, и здесь) CommandBus — они генерик по
// direction, поэтому регистрировать их здесь повторно не нужно; сюда
// добавлены только ListSalesPlansService/ListSalesPlanTemplatesService
// (обычные DI-провайдеры, не CQRS-хендлеры — SalesModule их не
// экспортирует, поэтому нужны собственные экземпляры, как и у
// SALES_PLAN_REPOSITORY/SALES_PLAN_TEMPLATE_REPOSITORY/
// EnsureSalesPlansForPeriodService ниже).
//
// Помимо этого — то, что для shop действительно самостоятельно: ERP-
// специфичный факт по МойСклад (ShopSalesFact/MoySkladSalesFactSourceRepository),
// сборка ShopSalesPerformance, собственный крон автосоздания плана и
// собственный HTTP-эндпоинт SalesPerformance (см.
// interface/http-controllers/list-shop-sales-performance.http.controller.ts
// и обоснование отдельного пути в config/app.routes.ts).
//
// SALES_PLAN_REPOSITORY/SALES_PLAN_TEMPLATE_REPOSITORY/
// EnsureSalesPlansForPeriodService/ListSalesPlansService/
// ListSalesPlanTemplatesService переиспользуются как классы направления
// service (см. выше) — предоставлены здесь отдельными экземплярами (Nest DI
// не разделяет провайдеров между модулями без явного экспорта/импорта
// модуля), но это тот же генерик-код поверх общей Prisma-модели, не
// дублирование ERP-логики.
@Module({
    imports: [CqrsModule],
    controllers: [
        ListShopSalesPerformanceHttpController,
        CreateShopSalesPlanHttpController,
        UpdateShopSalesPlanHttpController,
        DeleteShopSalesPlanHttpController,
        ApproveShopSalesPlanHttpController,
        ListShopSalesPlansHttpController,
        ListShopSalesPlanTemplatesHttpController,
        PutShopSalesPlanTemplateHttpController,
    ],
    providers: [
        { provide: SALES_PLAN_REPOSITORY, useClass: SalesPlanRepository },
        {
            provide: SALES_PLAN_TEMPLATE_REPOSITORY,
            useClass: SalesPlanTemplateRepository,
        },
        EnsureSalesPlansForPeriodService,
        ListSalesPlansService,
        ListSalesPlanTemplatesService,
        {
            provide: SHOP_SALES_FACT_SOURCE,
            useClass: MoySkladSalesFactSourceRepository,
        },
        GetShopSalesPerformanceService,
        // Алиас DI-токена на тот же провайдер — зеркало приёма из
        // SalesModule направления service (см. SALES_PERFORMANCE_READER
        // там): контроллер этого модуля инжектит GetShopSalesPerformanceService
        // напрямую, а будущий domains/shop/modules/accounting (Фаза 12)
        // будет инжектить абстракцию через SHOP_SALES_PERFORMANCE_READER.
        {
            provide: SHOP_SALES_PERFORMANCE_READER,
            useExisting: GetShopSalesPerformanceService,
        },
        ShopSalesPlanAutoCreationCron,
    ],
    exports: [SHOP_SALES_PERFORMANCE_READER],
})
export class ShopSalesModule {}
