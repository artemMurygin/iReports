import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { GoodsTurnoverReportResponse } from 'ireports-contracts';
import { ShopWarehouseModule } from '@/domains/shop/modules/warehouse/warehouse.module';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { GOODS_TURNOVER_REPORT_REPOSITORY } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { Period } from '@/shared/domain/period.value-object';
import { Money } from '@/domains/shop/modules/warehouse/domain/value-objects/money.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Настоящей инфраструктуры для test:e2e (jest-e2e.json + отдельная БД) в
// проекте пока нет (см. backend/CLAUDE.md) — этот тест, как и
// catalog.e2e.spec.ts того же модуля, поднимает ShopWarehouseModule целиком
// (реальные Controller → Service), подменяя границу с БД фейковым
// DatabaseService и GOODS_TURNOVER_REPORT_REPOSITORY — in-memory фейком
// репозитория.
describe('GET /v1/shop/warehouse/goods-turnover-report/:period (e2e)', () => {
    let app: INestApplication<Server>;

    const linesByPeriod = new Map<string, GoodsTurnoverReportLine[]>();

    const fakeRepository: GoodsTurnoverReportRepositoryPort = {
        findByPeriod: (period) =>
            Promise.resolve(linesByPeriod.get(period.getValue()) ?? []),
        replaceForPeriod: (period, lines) => {
            linesByPeriod.set(period.getValue(), lines);
            return Promise.resolve();
        },
    };

    const buildLine = (
        period: string,
        categoryId: string,
        warehouseId: string,
        turnoverSum: number,
        stockSum: number,
    ): GoodsTurnoverReportLine =>
        withRequestContext(() =>
            GoodsTurnoverReportLine.create({
                period: Period.create(period),
                categoryId,
                warehouseId,
                turnoverQuantity: 1,
                turnoverSum: Money.ofKopecks(turnoverSum),
                stockQuantity: 1,
                stockSum: Money.ofKopecks(stockSum),
            }),
        );

    // ShopWarehouseModule импортирует MoySkladSyncModule (ради
    // ProductFolderTreeService) и заводит собственный
    // ShopAccountingPeriodRepository под токеном
    // SHOP_ACCOUNTING_PERIOD_REPOSITORY (см. warehouse.module.ts) — оба
    // конструируют свои провайдеры через DatabaseService, но этот эндпоинт
    // их не вызывает, им достаточно фейкового DatabaseService (тот же
    // приём, что и в catalog.e2e.spec.ts/sales-performance.e2e.spec.ts).
    const fakeDatabaseService = {} as unknown as DatabaseService;

    @Global()
    @Module({
        providers: [
            { provide: DatabaseService, useValue: fakeDatabaseService },
        ],
        exports: [DatabaseService],
    })
    class FakeInfrastructureModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [FakeInfrastructureModule, ShopWarehouseModule],
        })
            .overrideProvider(GOODS_TURNOVER_REPORT_REPOSITORY)
            .useValue(fakeRepository)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        linesByPeriod.clear();
    });

    it('coefficient: null, когда строки за предыдущий период нет', async () => {
        linesByPeriod.set('2026-08', [
            buildLine('2026-08', 'folder-1', 'warehouse-1', 10_000, 6_000),
        ]);

        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/goods-turnover-report/2026-08')
            .expect(200);
        const body = response.body as GoodsTurnoverReportResponse;

        expect(body).toEqual([
            {
                categoryId: 'folder-1',
                warehouseId: 'warehouse-1',
                turnoverQuantity: 1,
                turnoverSum: 10_000,
                stockQuantity: 1,
                stockSum: 6_000,
                coefficient: null,
            },
        ]);
    });

    it('считает коэффициент по паре категория×склад, когда есть строка за предыдущий период', async () => {
        linesByPeriod.set('2026-07', [
            buildLine('2026-07', 'folder-1', 'warehouse-1', 5_000, 4_000),
        ]);
        linesByPeriod.set('2026-08', [
            buildLine('2026-08', 'folder-1', 'warehouse-1', 10_000, 6_000),
        ]);

        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/goods-turnover-report/2026-08')
            .expect(200);
        const body = response.body as GoodsTurnoverReportResponse;

        // turnoverSum(2026-08) / ((stockSum(2026-07) + stockSum(2026-08)) / 2)
        // = 10000 / ((4000 + 6000) / 2) = 10000 / 5000 = 2
        expect(body[0].coefficient).toBe(2);
    });

    it('фильтрует по warehouseId в query', async () => {
        linesByPeriod.set('2026-08', [
            buildLine('2026-08', 'folder-1', 'warehouse-1', 10_000, 6_000),
            buildLine('2026-08', 'folder-1', 'warehouse-2', 20_000, 8_000),
        ]);

        const response = await request(app.getHttpServer())
            .get(
                '/v1/shop/warehouse/goods-turnover-report/2026-08?warehouseId=warehouse-2',
            )
            .expect(200);
        const body = response.body as GoodsTurnoverReportResponse;

        expect(body).toHaveLength(1);
        expect(body[0].warehouseId).toBe('warehouse-2');
    });

    it('для периода без строк отчёта возвращает пустой массив', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/goods-turnover-report/2026-08')
            .expect(200);

        expect(response.body).toEqual([]);
    });

    it('отклоняет период не в формате YYYY-MM', async () => {
        await request(app.getHttpServer())
            .get('/v1/shop/warehouse/goods-turnover-report/2026')
            .expect(400);
    });
});
