import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { CatalogCategoryResponse } from 'ireports-contracts';
import { ShopWarehouseModule } from '@/domains/shop/modules/warehouse/warehouse.module';
import { DatabaseService } from '@/infrustructure/database/database.service';

// Настоящей инфраструктуры для test:e2e (jest-e2e.json + отдельная БД) в
// проекте пока нет (см. backend/CLAUDE.md) — этот тест, как и остальные
// *.e2e.spec.ts проекта, поднимает ShopWarehouseModule целиком через Nest
// TestingModule (реальные Controller → Service → мапперы), подменяя только
// границу с БД фейковым DatabaseService. В боевом приложении DatabaseService
// приходит из @Global() DatabaseModule — в изолированном TestingModule, где
// импортирован только ShopWarehouseModule, этого глобального модуля в графе
// нет, поэтому overrideProvider() не сработает (он лишь подменяет уже
// объявленный в графе провайдер): регистрируем DatabaseService сами тем же
// способом, @Global()-модулем (см. get-employee-salary-report.e2e.spec.ts).
describe('GET /shop/warehouse/catalog (e2e)', () => {
    let app: INestApplication<Server>;

    let folders: Array<{
        id: string;
        name: string;
        pathName: string;
        parentId: string | null;
    }> = [];

    const fakeDb = {
        moySkladProductFolder: {
            findMany: () => Promise.resolve(folders),
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
        folders = [];
    });

    it('возвращает дерево категорий (родитель/потомки), а не плоский список', async () => {
        folders = [
            {
                id: 'folder-root',
                name: 'Техника',
                pathName: 'Техника',
                parentId: null,
            },
            {
                id: 'folder-leaf',
                name: 'iPhone',
                pathName: 'Техника/iPhone',
                parentId: 'folder-root',
            },
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/catalog')
            .expect(200);
        const body = response.body as CatalogCategoryResponse[];

        expect(body).toEqual([
            {
                id: 'folder-root',
                name: 'Техника',
                pathName: 'Техника',
                children: [
                    {
                        id: 'folder-leaf',
                        name: 'iPhone',
                        pathName: 'Техника/iPhone',
                        children: [],
                    },
                ],
            },
        ]);
    });

    it('для пустого справочника возвращает пустой массив', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/warehouse/catalog')
            .expect(200);

        expect(response.body).toEqual([]);
    });
});
