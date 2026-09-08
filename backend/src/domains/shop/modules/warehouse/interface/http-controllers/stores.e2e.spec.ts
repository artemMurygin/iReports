import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { ShopStoresResponse } from 'ireports-contracts';
import { ShopWarehouseModule } from '@/domains/shop/modules/warehouse/warehouse.module';
import { DatabaseService } from '@/infrustructure/database/database.service';

// Настоящей инфраструктуры для test:e2e (jest-e2e.json + отдельная БД) в
// проекте пока нет (см. backend/CLAUDE.md) — этот тест, как и
// catalog.e2e.spec.ts того же модуля, поднимает ShopWarehouseModule целиком
// (реальные Controller → Service), подменяя только границу с БД фейковым
// DatabaseService.
describe('GET /v1/shop/warehouse/stores (e2e)', () => {
    let app: INestApplication<Server>;

    let stores: Array<{ id: string; name: string }> = [];

    const fakeDb = {
        moySkladStore: {
            findMany: () => Promise.resolve(stores),
        },
    } as unknown as DatabaseService;

    @Global()
    @Module({
        providers: [{ provide: DatabaseService, useValue: fakeDb }],
        exports: [DatabaseService],
    })
    class FakeInfrastructureModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [FakeInfrastructureModule, ShopWarehouseModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        stores = [];
    });

    it('возвращает список складов', async () => {
        stores = [
            { id: 'store-1', name: 'Основной склад' },
            { id: 'store-2', name: 'Онлайн-склад' },
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/stores')
            .expect(200);
        const body = response.body as ShopStoresResponse;

        expect(body).toEqual([
            { id: 'store-1', name: 'Основной склад' },
            { id: 'store-2', name: 'Онлайн-склад' },
        ]);
    });

    it('для пустого справочника складов возвращает пустой массив', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/stores')
            .expect(200);

        expect(response.body).toEqual([]);
    });
});
