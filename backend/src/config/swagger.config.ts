import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { ShopSalesModule } from '@/domains/shop/modules/sales/shop-sales.module';
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/shop-accounting.module';
import { ShopWarehouseModule } from '@/domains/shop/modules/warehouse/shop-warehouse.module';
import { EmployeeIdentityModule } from '@/modules/employee-identity/employee-identity.module';
import { PricingModule } from '@/domains/service/modules/marketing/pricing/pricing.module';
import { ShopPricingModule } from '@/domains/shop/modules/marketing/pricing/pricing.module';

// include в каждом документе ниже: документируем только отрефакторенные
// DDD-модули (см. backend/CLAUDE.md); модули из src/TODO/* сюда намеренно
// не входят — это старый, ещё не переложенный на nestjs-zod/DDD код,
// который мы не трогаем (см. src/TODO/CLAUDE.md), и как минимум один из
// них (getServiceFunnelReportDTO в TODO/reports) роняет генерацию
// OpenAPI-схемы на старте, потому что использует z.coerce.date(), а
// zod v4 toJSONSchema() не умеет сериализовать Date.
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
            include: [SalesModule, AccountingModule, PricingModule],
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
        include: [
            ShopSalesModule,
            ShopAccountingModule,
            ShopWarehouseModule,
            ShopPricingModule,
        ],
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
