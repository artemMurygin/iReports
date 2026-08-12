import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import * as XLSX from 'xlsx';
import type {
    PriceImportJobStatusResponse,
    StartPriceImportResponse,
} from 'ireports-contracts';
import { ShopPricingModule } from '@/domains/shop/modules/marketing/pricing/pricing.module';
import { MoyskladService } from '@/domains/shop/integrations/moySklad/moysklad.service';
import { PRODUCT_MATCHER } from '@/domains/shop/modules/marketing/pricing/application/ports/product-matcher.port';
import type {
    CatalogItem,
    ProductMatcher,
} from '@/domains/shop/modules/marketing/pricing/application/ports/product-matcher.port';
import { RESULT_SHEET_GATEWAY } from '@/domains/shop/modules/marketing/pricing/application/ports/result-sheet-gateway.port';
import type { ResultSheetGateway } from '@/domains/shop/modules/marketing/pricing/application/ports/result-sheet-gateway.port';
import { ProductMatch } from '@/domains/shop/modules/marketing/pricing/domain/value-objects/product-match.value-object';
import type { CategoryKey } from '@/domains/shop/modules/marketing/pricing/domain/services/row-categorization.service';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Мини-XLSX с одной строкой iPhone — тот же layout, что в
// start-price-import.handler.spec.ts (см. комментарий там про непустые
// строки-заполнители перед данными).
function buildPriceListFileBase64(): string {
    const workbook = XLSX.utils.book_new();
    const iphoneWatchSheet = XLSX.utils.aoa_to_sheet([
        ['—'],
        ['—'],
        ['—'],
        ['', 'Apple iPhone 16 128GB Black', '', 65000],
    ]);
    XLSX.utils.book_append_sheet(
        workbook,
        iphoneWatchSheet,
        'Apple(iPhone, Watch)',
    );
    const ipadMacbookSheet = XLSX.utils.aoa_to_sheet([['—']]);
    XLSX.utils.book_append_sheet(
        workbook,
        ipadMacbookSheet,
        'Apple (iPad, Macbook)',
    );
    const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
    }) as Buffer;
    return buffer.toString('base64');
}

// E2e поверх реального ShopPricingModule (реальные контроллеры ->
// application-сервисы/хендлер -> реальный in-memory PRICE_IMPORT_JOB_STORE,
// см. pricing.module.ts) — граница подмены только на трёх внешних
// зависимостях пайплайна (МойСклад/AI-матчер/Google Sheets), тем же
// приёмом, что и start-price-import.handler.spec.ts, но здесь через живой
// HTTP-стек (POST -> контроллер генерирует id -> фоновый пайплайн реально
// прогоняет джобу через реальный store -> GET .../status и SSE читают тот
// же store).
describe('POST /v1/shop/marketing/pricing/import-costs (e2e)', () => {
    let app: INestApplication<Server>;

    const fakeMatcher: ProductMatcher = {
        formatProductNames: (names: string[]) => Promise.resolve(names),
        match: (
            _category: CategoryKey,
            priceRows: { name: string; price: string | number | null }[],
            catalogItems: CatalogItem[],
        ) => {
            if (priceRows.length === 0 || catalogItems.length === 0) {
                return Promise.resolve([]);
            }
            return Promise.resolve([
                ProductMatch.create({
                    sourceRowName: priceRows[0].name,
                    sourcePrice: Number(priceRows[0].price),
                    matchedProductId: catalogItems[0].id,
                    matchedProductName: catalogItems[0].name,
                    method: 'llm',
                    confidence: 1,
                }),
            ]);
        },
    };

    const writeCostChanges = () => Promise.resolve();
    const fakeResultSheetGateway: ResultSheetGateway = { writeCostChanges };

    const fakeMoysklad = {
        // eslint-disable-next-line @typescript-eslint/require-await
        fetchAssortment: async function* (filter?: string) {
            void filter;
            yield [{ id: 'ms-1', name: 'Каталожный товар' }];
        },
        batchUpdateProducts: () => Promise.resolve(),
    } as unknown as MoyskladService;

    beforeAll(async () => {
        // ShopPricingModule импортирует AiModule/GoogleSheetsModule целиком
        // (см. pricing.module.ts) — их собственные провайдеры (AiHttpService
        // и т.д.) конструируются Nest DI при поднятии модуля независимо от
        // того, что PRODUCT_MATCHER/RESULT_SHEET_GATEWAY переопределены
        // ниже фейками (overrideProvider подменяет только конкретный
        // токен, а не сами импортированные модули); AiHttpService создаёт
        // клиент OpenAI сразу в конструкторе и падает без апи-ключа —
        // фиктивное значение здесь не используется ни для одного реального
        // сетевого вызова (сам AiService нигде в этих тестах не
        // задействован — только его DI-соседи должны успешно
        // сконструироваться).
        process.env.OMNIROTE_TOKEN ??= 'test-token';

        const moduleRef = await Test.createTestingModule({
            imports: [ShopPricingModule],
        })
            .overrideProvider(PRODUCT_MATCHER)
            .useValue(fakeMatcher)
            .overrideProvider(RESULT_SHEET_GATEWAY)
            .useValue(fakeResultSheetGateway)
            .overrideProvider(MoyskladService)
            .useValue(fakeMoysklad)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(
                req as never,
                res as never,
                next,
            ),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    // Ждёт, пока джоба дойдёт до терминального статуса (COMPLETED/FAILED) —
    // пайплайн здесь целиком in-memory/фейковый, укладывается в единицы
    // миллисекунд, поэтому короткий поллинг вместо реального SSE-ожидания.
    async function waitForTerminalStatus(
        id: string,
    ): Promise<PriceImportJobStatusResponse> {
        for (let attempt = 0; attempt < 50; attempt += 1) {
            const response = await request(app.getHttpServer())
                .get(`/v1/shop/marketing/pricing/import-costs/${id}/status`)
                .expect(200);
            const body = response.body as PriceImportJobStatusResponse;
            if (body.status === 'COMPLETED' || body.status === 'FAILED') {
                return body;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw new Error(`Джоба ${id} не завершилась за отведённое время`);
    }

    it('запускает джобу fire-and-forget: отвечает {id} сразу, не дожидаясь пайплайна', async () => {
        const response = await request(app.getHttpServer())
            .post('/v1/shop/marketing/pricing/import-costs')
            .send({ file: buildPriceListFileBase64() })
            .expect(201);

        const body = response.body as StartPriceImportResponse;
        expect(typeof body.id).toBe('string');
        expect(body.id.length).toBeGreaterThan(0);
    });

    it('GET .../status отражает прогресс той же джобы вплоть до COMPLETED, id ответа POST используется как id джобы', async () => {
        const startResponse = await request(app.getHttpServer())
            .post('/v1/shop/marketing/pricing/import-costs')
            .send({ file: buildPriceListFileBase64() })
            .expect(201);
        const { id } = startResponse.body as StartPriceImportResponse;

        const finalStatus = await waitForTerminalStatus(id);

        expect(finalStatus.id).toBe(id);
        expect(finalStatus.status).toBe('COMPLETED');
        expect(finalStatus.errorMessage).toBeNull();
    });

    it('GET .../status 404 для неизвестного id', async () => {
        await request(app.getHttpServer())
            .get('/v1/shop/marketing/pricing/import-costs/unknown-id/status')
            .expect(404);
    });

    it('SSE GET .../import-costs/:id 404 для неизвестного id (до открытия потока)', async () => {
        await request(app.getHttpServer())
            .get('/v1/shop/marketing/pricing/import-costs/unknown-id')
            .expect(404);
    });

    it('SSE GET .../import-costs/:id стримит снапшоты джобы вплоть до COMPLETED', async () => {
        const startResponse = await request(app.getHttpServer())
            .post('/v1/shop/marketing/pricing/import-costs')
            .send({ file: buildPriceListFileBase64() })
            .expect(201);
        const { id } = startResponse.body as StartPriceImportResponse;

        const response = await request(app.getHttpServer())
            .get(`/v1/shop/marketing/pricing/import-costs/${id}`)
            .expect(200);

        expect(response.headers['content-type']).toContain('text/event-stream');
        // Поток завершается сам (Subject.complete() на терминальном статусе,
        // см. InMemoryPriceImportJobStore.save) — supertest ждёт закрытия
        // соединения и отдаёт всё, что было отправлено на этот момент, одной
        // строкой; каждое SSE-сообщение — своя строка `data: {...}`.
        const events = response.text
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => JSON.parse(line.slice('data:'.length)) as unknown);

        expect(events.length).toBeGreaterThan(0);
        const statuses = events.map(
            (event) => (event as PriceImportJobStatusResponse).status,
        );
        expect(statuses).toContain('COMPLETED');
        // Джоба завершается за миллисекунды — heartbeat (20с, см.
        // HEARTBEAT_INTERVAL_MS в subscribe-price-import-job-progress
        // .http.controller.ts) физически не успевает сработать в этом
        // сценарии; сам механизм heartbeat/его 20-секундный интервал
        // проверяется отдельным тестом на fake-таймерах (см.
        // subscribe-price-import-job-progress.http.controller.spec.ts) — не
        // реальным ожиданием 20 секунд.
        expect(
            events.some(
                (event) => (event as { type?: string }).type === 'heartbeat',
            ),
        ).toBe(false);
    });
});
