import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { ReportsModule } from '@/domains/service/modules/reports/reports.module';
import { LEAD_REPOSITORY } from '@/domains/service/modules/sales/domain/ports/sales.repositories.port';
import type { LeadRepositoryPort } from '@/domains/service/modules/sales/domain/ports/sales.repositories.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import { SERVICE_SALES_FACT_SOURCE } from '@/domains/service/modules/sales/application/ports/service-sales-fact-source.port';
import type { ServiceSalesFactSourcePort } from '@/domains/service/modules/sales/application/ports/service-sales-fact-source.port';
import { DEAL_LIST_REPOSITORY } from '@/domains/service/modules/sales/application/ports/deal-list.port';
import type { DealListRepositoryPort } from '@/domains/service/modules/sales/application/ports/deal-list.port';
import { DEAL_CATALOG_READER } from '@/domains/service/modules/sales/application/ports/deal-catalog.port';
import type { DealCatalogReaderPort } from '@/domains/service/modules/sales/application/ports/deal-catalog.port';
import { FUNNEL_DEAL_REPOSITORY } from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import type { FunnelDealRepositoryPort } from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { SERVICE_SALES_SOURCE } from '@/domains/service/modules/reports/application/ports/service-sales.port';
import type { ServiceSalesSourcePort } from '@/domains/service/modules/reports/application/ports/service-sales.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';

// Смоук-тест генерации OpenAPI (Фаза 5, "Когда готово": "OpenAPI-документы
// генерируются — блокер z.coerce.date() устранён") — TODO/reports
// (getServiceFunnelReportDTO, z.coerce.date()) когда-то считался причиной
// падения генерации схемы; TODO/reports удалён целиком, блокер устранён.
// Собирает подмножество serviceDocument (SalesModule, AccountingModule,
// ReportsModule — не обязательно 1:1 с полным include в swagger.config.ts,
// см. его актуальный список отдельно), реальными Controller → Service →
// доменными VO, с подменой только границы с БД (тот же приём, что
// list-deals.e2e.spec.ts и get-employee-salary-report.e2e.spec.ts: фейковый
// DatabaseService вместо живого Postgres — SwaggerModule.createDocument
// никогда не выполняет ни одного запроса, ей достаточно того, что граф DI
// собирается).
describe('setupSwagger — serviceDocument (смоук-тест генерации OpenAPI)', () => {
    const fakeLeadRepo: LeadRepositoryPort = {
        findModifiedSince: () => Promise.resolve([]),
    };
    const fakeFactSource: ServiceSalesFactSourcePort = {
        aggregate: () => Promise.resolve([]),
    };
    const fakeTemplateRepo: SalesPlanTemplateRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        findByScope: () => Promise.resolve(null),
        findAll: () => Promise.resolve([]),
    };
    const fakeDealListRepo: DealListRepositoryPort = {
        findByDateRange: () => Promise.resolve([]),
    };
    const fakeDealCatalogReader: DealCatalogReaderPort = {
        findStages: () => Promise.resolve([]),
        findDeviceTypes: () => Promise.resolve([]),
        findManagers: () => Promise.resolve([]),
        findSources: () => Promise.resolve([]),
        findStageGroups: () => Promise.resolve([]),
    };
    const fakeFunnelDealRepo: FunnelDealRepositoryPort = {
        findByFilter: () => Promise.resolve([]),
    };
    const fakePlanRepo: SalesPlanRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByIds: () => Promise.resolve([]),
        findByScope: () => Promise.resolve(null),
        findByDirectionAndPeriod: () => Promise.resolve([]),
    };
    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: () => Promise.resolve(),
        findByEmployee: () => Promise.resolve(null),
        findByEmployees: () => Promise.resolve([]),
        findAllEmployeeTargets: () => Promise.resolve([]),
        findByDepartment: () => Promise.resolve(null),
        findAllDepartmentTargets: () => Promise.resolve([]),
        findIdByTarget: () => Promise.resolve(null),
        findById: () => Promise.resolve(null),
        findAll: () => Promise.resolve([]),
        update: () => Promise.resolve(),
        initializeName: () => Promise.resolve(),
    };
    const fakeSalaryRuleRepo: SalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
        deleteAllByMotivationSchema: () => Promise.resolve(),
    };
    const fakeAccountingPeriodRepo: AccountingPeriodRepositoryPort = {
        findByDirectionAndPeriod: () => Promise.resolve(null),
        save: () => Promise.resolve(),
    };
    const fakeAccountingPeriodSnapshot: AccountingPeriodSnapshotPort = {
        saveAll: () => Promise.resolve(),
        findByKey: () => Promise.resolve(null),
        findManyByKey: () => Promise.resolve(new Map()),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    const fakeAccountingCalculationCache: AccountingCalculationCachePort = {
        find: () => Promise.resolve(null),
        upsert: () => Promise.resolve(),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    const fakeDomainSyncStatus: DomainSyncStatusPort = {
        getLastSuccessfulSyncAt: () => Promise.resolve(null),
        markSuccessful: () => Promise.resolve(),
    };
    const fakeServiceCalculationData: ServiceCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findServiceCompletedItems: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve(0),
        findOrderPayedItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    // SERVICE_SALES_SOURCE (Фаза 5) — единственный порт нового ReportsModule.
    const fakeServiceSalesSource: ServiceSalesSourcePort = {
        findByFilter: () => Promise.resolve([]),
        listCategories: () => Promise.resolve([]),
    };

    const fakeUnitOfWork: UnitOfWorkPort = {
        run: (work) => work(),
    };
    const fakeDatabaseService = {} as unknown as DatabaseService;

    @Global()
    @Module({
        providers: [
            { provide: UNIT_OF_WORK, useValue: fakeUnitOfWork },
            { provide: DatabaseService, useValue: fakeDatabaseService },
        ],
        exports: [UNIT_OF_WORK, DatabaseService],
    })
    class FakeInfrastructureModule {}

    it('SwaggerModule.createDocument({ include: [SalesModule, AccountingModule, ReportsModule] }) не бросает исключение', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                FakeInfrastructureModule,
                SalesModule,
                AccountingModule,
                ReportsModule,
            ],
        })
            .overrideProvider(LEAD_REPOSITORY)
            .useValue(fakeLeadRepo)
            .overrideProvider(SALES_PLAN_REPOSITORY)
            .useValue(fakePlanRepo)
            .overrideProvider(SALES_PLAN_TEMPLATE_REPOSITORY)
            .useValue(fakeTemplateRepo)
            .overrideProvider(SERVICE_SALES_FACT_SOURCE)
            .useValue(fakeFactSource)
            .overrideProvider(DEAL_LIST_REPOSITORY)
            .useValue(fakeDealListRepo)
            .overrideProvider(DEAL_CATALOG_READER)
            .useValue(fakeDealCatalogReader)
            .overrideProvider(FUNNEL_DEAL_REPOSITORY)
            .useValue(fakeFunnelDealRepo)
            .overrideProvider(MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeMotivationSchemaRepo)
            .overrideProvider(SALARY_RULE_REPOSITORY)
            .useValue(fakeSalaryRuleRepo)
            .overrideProvider(ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeAccountingPeriodRepo)
            .overrideProvider(ACCOUNTING_PERIOD_SNAPSHOT)
            .useValue(fakeAccountingPeriodSnapshot)
            .overrideProvider(ACCOUNTING_CALCULATION_CACHE)
            .useValue(fakeAccountingCalculationCache)
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SERVICE_CALCULATION_DATA)
            .useValue(fakeServiceCalculationData)
            .overrideProvider(SERVICE_SALES_SOURCE)
            .useValue(fakeServiceSalesSource)
            .compile();

        const app = moduleRef.createNestApplication();
        await app.init();

        try {
            const config = new DocumentBuilder()
                .setTitle('iReports API — Service')
                .setVersion('1.0')
                .build();

            let document: ReturnType<typeof SwaggerModule.createDocument>;
            expect(() => {
                document = SwaggerModule.createDocument(app, config, {
                    include: [SalesModule, AccountingModule, ReportsModule],
                });
            }).not.toThrow();

            // cleanupOpenApiDoc — тот же постпроцессинг, что setupSwagger
            // реально применяет перед SwaggerModule.setup(), тоже не должен
            // бросать.
            expect(() => cleanupOpenApiDoc(document!)).not.toThrow();

            const paths = Object.keys(document!.paths);
            // Отчёт по воронке (Фаза 4, modules/sales) — контракт с ISO-
            // строками дат вместо z.coerce.date(), тот самый фикс блокера.
            expect(paths).toContain('/v1/service/sales/funnel-report');
            // Аналитика услуг и категории (Фаза 5, новый ReportsModule).
            expect(paths).toContain('/v1/service/reports/services');
            expect(paths).toContain('/v1/service/reports/service-categories');
        } finally {
            await app.close();
        }
    });
});
