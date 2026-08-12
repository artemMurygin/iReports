import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { ReportsModule } from '@/domains/service/modules/reports/reports.module';
import { ShopSalesModule } from '@/domains/shop/modules/sales/shop-sales.module';
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/shop-accounting.module';
import { ShopWarehouseModule } from '@/domains/shop/modules/warehouse/shop-warehouse.module';
import { EmployeeIdentityModule } from '@/modules/employee-identity/employee-identity.module';

// include в каждом документе ниже: документируем только отрефакторенные
// DDD-модули (см. backend/CLAUDE.md); модули из src/TODO/* сюда намеренно
// не входят — это старый, ещё не переложенный на nestjs-zod/DDD код,
// который мы не трогаем (см. src/TODO/CLAUDE.md). До Фазы 5
// (docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
// один из них (getServiceFunnelReportDTO в TODO/reports, использовавший
// z.coerce.date(), которую zod v4 toJSONSchema() не умеет сериализовать)
// ронял генерацию OpenAPI-схемы на старте — TODO/reports удалён этой же
// фазой целиком (перенесён в ReportsModule ниже и в воронку
// modules/sales), блокер устранён: все контракты новых модулей используют
// ISO-строки дат вместо z.coerce.date() (см. contracts/commands/report.ts,
// contracts/commands/deal.ts).
export function setupSwagger(app: INestApplication): void {
    const serviceSwaggerConfig = new DocumentBuilder()
        .setTitle('iReports API — Service')
        .setDescription('API направления Service (ремонт и обслуживание)')
        .setVersion('1.0')
        .build();
    const serviceDocument = SwaggerModule.createDocument(
        app,
        serviceSwaggerConfig,
        {
            include: [SalesModule, AccountingModule, ReportsModule],
        },
    );
    SwaggerModule.setup(
        'docs/service',
        app,
        cleanupOpenApiDoc(serviceDocument),
    );

    const shopSwaggerConfig = new DocumentBuilder()
        .setTitle('iReports API — Shop')
        .setDescription('API направления Shop (розничная продажа устройств)')
        .setVersion('1.0')
        .build();
    const shopDocument = SwaggerModule.createDocument(app, shopSwaggerConfig, {
        include: [ShopSalesModule, ShopAccountingModule, ShopWarehouseModule],
    });
    SwaggerModule.setup('docs/shop', app, cleanupOpenApiDoc(shopDocument));

    const commonSwaggerConfig = new DocumentBuilder()
        .setTitle('iReports API — Common')
        .setDescription('Общие для всех направлений API (сквозные модули)')
        .setVersion('1.0')
        .build();
    const commonDocument = SwaggerModule.createDocument(
        app,
        commonSwaggerConfig,
        {
            include: [EmployeeIdentityModule],
        },
    );
    SwaggerModule.setup('docs/common', app, cleanupOpenApiDoc(commonDocument));

    // Единая точка входа /docs: нативный dropdown-селектор Swagger UI (опция
    // urls) для переключения между тремя документами выше без ручного набора
    // адреса — сам JSON берётся из уже поднятых /docs/{service,shop,common}-json.
    SwaggerModule.setup('docs', app, cleanupOpenApiDoc(serviceDocument), {
        explorer: true,
        swaggerOptions: {
            urls: [
                { name: 'Сервис', url: '/docs/service-json' },
                { name: 'Магазин', url: '/docs/shop-json' },
                { name: 'Общее API', url: '/docs/common-json' },
            ],
        },
    });
}
