import * as XLSX from 'xlsx';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { MoyskladService } from '@/domains/shop/integrations/moySklad/moysklad.service';
import { StartPriceImportHandler } from './start-price-import.handler';
import { StartPriceImportCommand } from './start-price-import.command';
import { PriceListXlsxParser } from '../../infrastructure/xlsx/price-list-xlsx.parser';
import { PriceImportJob } from '../../domain/entities/price-import-job.entity';
import { ProductMatch } from '../../domain/value-objects/product-match.value-object';
import { InMemoryPriceImportAbortRegistry } from '../../infrastructure/abort/in-memory-price-import-abort.registry';
import type { PriceImportNotifier } from '../ports/price-import-notifier.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import type {
    CatalogItem,
    ProductMatcher,
} from '../ports/product-matcher.port';
import type { ResultSheetGateway } from '../ports/result-sheet-gateway.port';
import type { CategoryKey } from '../../domain/services/row-categorization.service';

// Мини-XLSX с одной строкой iPhone (лист "Apple(iPhone, Watch)") и одной строкой MacBook (лист
// "Apple (iPad, Macbook)") — layout колонок/шапки повторяет структуру, которую ждёт
// PriceListXlsxParser (см. price-list-xlsx.parser.ts): для iPhone/Watch данные с 4-й строки
// (индекс 3), для iPad/MacBook — с 5-й (индекс 4). Строки-заполнители перед данными обязаны быть
// непустыми (`['—']`, а не `[]`) — иначе XLSX схлопывает диапазон листа до первой строки с
// реальными данными и `.slice()` в парсере отсчитывает не от той строки (см. тот же комментарий в
// price-list-xlsx.parser.spec.ts).
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

    const ipadMacbookSheet = XLSX.utils.aoa_to_sheet([
        ['—'],
        ['—'],
        ['—'],
        ['—'],
        ['MacBook Air 13 Midnight M5 16/512', '', 120000],
    ]);
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

function buildFakeJobStore(): {
    store: PriceImportJobStore;
    statusHistory: string[];
} {
    const jobs = new Map<string, PriceImportJob>();
    // `job` — один и тот же мутируемый объект на каждый save(), поэтому статус читается синхронно
    // в момент save(), а не из отложенно прочитанной ссылки на агрегат (см. тот же приём/комментарий
    // в in-memory-price-import-job.store.spec.ts).
    const statusHistory: string[] = [];
    const store: PriceImportJobStore = {
        save: (job) => {
            jobs.set(job.id, job);
            statusHistory.push(job.status);
        },
        findById: (id) => jobs.get(id),
        findActive: () => undefined,
        subscribe: () => undefined,
        delete: (id) => {
            jobs.delete(id);
        },
    };
    return { store, statusHistory };
}

function buildFakeMoysklad(): {
    moysklad: MoyskladService;
    batchUpdateProducts: jest.Mock;
} {
    const batchUpdateProducts = jest.fn().mockResolvedValue(undefined);
    const moysklad = {
        fetchAssortment: async function* (
            filter?: string,
        ): AsyncGenerator<{ id: string; name: string }[]> {
            void filter;
            await Promise.resolve();
            yield [{ id: 'ms-1', name: 'Каталожный товар' }];
        },
        batchUpdateProducts,
    } as unknown as MoyskladService;
    return { moysklad, batchUpdateProducts };
}

// Матчер, который сопоставляет первую строку прайса с первым товаром каталога той же категории.
function buildHappyPathMatcher(): ProductMatcher {
    return {
        formatProductNames: jest
            .fn()
            .mockImplementation((names: string[]) => Promise.resolve(names)),
        match: jest.fn().mockImplementation(
            (
                _category: CategoryKey,
                priceRows: {
                    name: string;
                    price: string | number | null;
                }[],
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
        ),
    };
}

function buildFakeResultSheetGateway(): {
    gateway: ResultSheetGateway;
    writeCostChanges: jest.Mock;
} {
    const writeCostChanges = jest.fn().mockResolvedValue(undefined);
    return { gateway: { writeCostChanges }, writeCostChanges };
}

function buildFakeNotifier(): jest.Mocked<PriceImportNotifier> {
    return {
        notifyUploaded: jest.fn().mockResolvedValue(undefined),
        notifyUnchanged: jest.fn().mockResolvedValue(undefined),
        notifyFailed: jest.fn().mockResolvedValue(undefined),
        notifyPriceUpdateFailed: jest.fn().mockResolvedValue(undefined),
        notifyManualUploaded: jest.fn().mockResolvedValue(undefined),
        notifyManualFailed: jest.fn().mockResolvedValue(undefined),
    };
}

describe('StartPriceImportHandler', () => {
    it('happy path: проводит джобу CREATED -> RUNNING -> COMPLETED и пишет изменения цен', async () => {
        await withRequestContext(async () => {
            const { store, statusHistory } = buildFakeJobStore();
            const matcher = buildHappyPathMatcher();
            const { gateway, writeCostChanges } = buildFakeResultSheetGateway();
            const { moysklad, batchUpdateProducts } = buildFakeMoysklad();

            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                new InMemoryPriceImportAbortRegistry(),
                new PriceListXlsxParser(),
                moysklad,
                buildFakeNotifier(),
            );

            const command = new StartPriceImportCommand({
                fileBase64: buildPriceListFileBase64(),
            });

            const result = await handler.execute(command);

            const job = store.findById(result.id);
            expect(job).toBeDefined();
            expect(job!.isCompleted()).toBe(true);
            expect(job!.result?.matches).toHaveLength(2); // iPhone + MacBook
            expect(job!.result?.costChanges).toHaveLength(2);

            expect(statusHistory[0]).toBe('CREATED');
            expect(statusHistory).toContain('RUNNING');
            expect(statusHistory[statusHistory.length - 1]).toBe('COMPLETED');

            expect(writeCostChanges).toHaveBeenCalledTimes(1);
            expect(batchUpdateProducts).toHaveBeenCalledTimes(1);
        });
    });

    it('категории сопоставляются параллельно: второй AI-запрос стартует до ответа на первый', async () => {
        await withRequestContext(async () => {
            const { store } = buildFakeJobStore();
            const { gateway } = buildFakeResultSheetGateway();
            const { moysklad } = buildFakeMoysklad();

            // Матчер отвечает только когда вызваны обе категории (iPhone и MacBook из файла):
            // при последовательном обходе первый вызов никогда бы не дождался второго.
            let inFlight = 0;
            let maxInFlight = 0;
            let releaseAll: () => void = () => undefined;
            const allCalled = new Promise<void>((resolve) => {
                releaseAll = resolve;
            });
            const matcher: ProductMatcher = {
                formatProductNames: jest
                    .fn()
                    .mockImplementation((names: string[]) =>
                        Promise.resolve(names),
                    ),
                match: jest.fn().mockImplementation(
                    async (
                        _category: CategoryKey,
                        priceRows: {
                            name: string;
                            price: string | number | null;
                        }[],
                        catalogItems: CatalogItem[],
                    ) => {
                        inFlight += 1;
                        maxInFlight = Math.max(maxInFlight, inFlight);
                        if (inFlight === 2) releaseAll();
                        await allCalled;
                        inFlight -= 1;
                        return [
                            ProductMatch.create({
                                sourceRowName: priceRows[0].name,
                                sourcePrice: Number(priceRows[0].price),
                                matchedProductId: catalogItems[0].id,
                                matchedProductName: catalogItems[0].name,
                                method: 'llm',
                                confidence: 1,
                            }),
                        ];
                    },
                ),
            };

            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                new InMemoryPriceImportAbortRegistry(),
                new PriceListXlsxParser(),
                moysklad,
                buildFakeNotifier(),
            );

            const result = await handler.execute(
                new StartPriceImportCommand({
                    fileBase64: buildPriceListFileBase64(),
                }),
            );

            const job = store.findById(result.id);
            expect(job!.isCompleted()).toBe(true);
            expect(maxInFlight).toBe(2);
            expect(job!.result?.matches).toHaveLength(2);
        });
    });

    it('матчер падает -> джоба переходит в FAILED с захваченным сообщением об ошибке', async () => {
        await withRequestContext(async () => {
            const { store, statusHistory } = buildFakeJobStore();
            const matcher: ProductMatcher = {
                formatProductNames: jest
                    .fn()
                    .mockImplementation((names: string[]) =>
                        Promise.resolve(names),
                    ),
                match: jest.fn().mockRejectedValue(new Error('AI недоступен')),
            };
            const { gateway, writeCostChanges } = buildFakeResultSheetGateway();
            const { moysklad, batchUpdateProducts } = buildFakeMoysklad();

            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                new InMemoryPriceImportAbortRegistry(),
                new PriceListXlsxParser(),
                moysklad,
                buildFakeNotifier(),
            );

            const command = new StartPriceImportCommand({
                fileBase64: buildPriceListFileBase64(),
            });

            const result = await handler.execute(command);

            const job = store.findById(result.id);
            expect(job).toBeDefined();
            expect(job!.isFailed()).toBe(true);
            expect(job!.errorMessage).toBe('AI недоступен');

            expect(statusHistory[0]).toBe('CREATED');
            expect(statusHistory).toContain('RUNNING');
            expect(statusHistory[statusHistory.length - 1]).toBe('FAILED');

            // Пайплайн остановился до записи результата — ни МойСклад, ни таблица не тронуты.
            expect(writeCostChanges).not.toHaveBeenCalled();
            expect(batchUpdateProducts).not.toHaveBeenCalled();
        });
    });
    it('отмена во время LLM-сопоставления: signal абортится, джоба остаётся CANCELLED, запись не выполняется', async () => {
        await withRequestContext(async () => {
            const { store } = buildFakeJobStore();
            const registry = new InMemoryPriceImportAbortRegistry();
            let seenSignal: AbortSignal | undefined;
            let onMatchStarted: () => void = () => undefined;
            const matchStarted = new Promise<void>((resolve) => {
                onMatchStarted = resolve;
            });
            const matcher: ProductMatcher = {
                formatProductNames: jest
                    .fn()
                    .mockImplementation((names: string[]) =>
                        Promise.resolve(names),
                    ),
                // Висит, пока signal не будет аборчен — как оборванный HTTP-запрос к LLM.
                match: jest.fn().mockImplementation(
                    (
                        _c: CategoryKey,
                        _r: unknown,
                        _i: unknown,
                        signal?: AbortSignal,
                    ) =>
                        new Promise((_resolve, reject) => {
                            seenSignal = signal;
                            onMatchStarted();
                            signal?.addEventListener('abort', () =>
                                reject(new Error('aborted')),
                            );
                        }),
                ),
            };
            const { gateway, writeCostChanges } = buildFakeResultSheetGateway();
            const { moysklad, batchUpdateProducts } = buildFakeMoysklad();
            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                registry,
                new PriceListXlsxParser(),
                moysklad,
                buildFakeNotifier(),
            );
            const command = new StartPriceImportCommand({
                fileBase64: buildPriceListFileBase64(),
            });

            const run = handler.execute(command);
            await matchStarted;
            const job = store.findById(command.id)!;
            job.cancel();
            store.save(job);
            registry.abort(command.id);
            await run;

            expect(seenSignal?.aborted).toBe(true);
            expect(job.isCancelled()).toBe(true);
            expect(job.errorMessage).toBeNull();
            expect(batchUpdateProducts).not.toHaveBeenCalled();
            expect(writeCostChanges).not.toHaveBeenCalled();
        });
    });

    // spec: shop/price-import-schedule#уведомления-о-ручной-выгрузке
    describe('уведомления о ручной выгрузке (notifyResult)', () => {
        function build(matcher: ProductMatcher) {
            const { store } = buildFakeJobStore();
            const { gateway } = buildFakeResultSheetGateway();
            const { moysklad } = buildFakeMoysklad();
            const notifier = buildFakeNotifier();
            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                new InMemoryPriceImportAbortRegistry(),
                new PriceListXlsxParser(),
                moysklad,
                notifier,
            );
            return { handler, notifier };
        }

        const failingMatcher = (): ProductMatcher => ({
            formatProductNames: jest
                .fn()
                .mockImplementation((n: string[]) => Promise.resolve(n)),
            match: jest.fn().mockRejectedValue(new Error('AI недоступен')),
        });

        it('успех при notifyResult: уведомление о выгрузке в переоценку', async () => {
            await withRequestContext(async () => {
                const { handler, notifier } = build(buildHappyPathMatcher());
                await handler.execute(
                    new StartPriceImportCommand({
                        fileBase64: buildPriceListFileBase64(),
                        notifyResult: true,
                    }),
                );
                expect(notifier.notifyManualUploaded).toHaveBeenCalledTimes(1);
                expect(notifier.notifyManualFailed).not.toHaveBeenCalled();
            });
        });

        it('ошибка при notifyResult: уведомление об ошибке', async () => {
            await withRequestContext(async () => {
                const { handler, notifier } = build(failingMatcher());
                await handler.execute(
                    new StartPriceImportCommand({
                        fileBase64: buildPriceListFileBase64(),
                        notifyResult: true,
                    }),
                );
                expect(notifier.notifyManualFailed).toHaveBeenCalledTimes(1);
                expect(notifier.notifyManualUploaded).not.toHaveBeenCalled();
            });
        });

        it('без notifyResult (автовыгрузка шлёт свои уведомления) — ничего не отправляется', async () => {
            await withRequestContext(async () => {
                const ok = build(buildHappyPathMatcher());
                await ok.handler.execute(
                    new StartPriceImportCommand({
                        fileBase64: buildPriceListFileBase64(),
                    }),
                );
                const bad = build(failingMatcher());
                await bad.handler.execute(
                    new StartPriceImportCommand({
                        fileBase64: buildPriceListFileBase64(),
                    }),
                );
                for (const { notifier } of [ok, bad]) {
                    expect(notifier.notifyManualUploaded).not.toHaveBeenCalled();
                    expect(notifier.notifyManualFailed).not.toHaveBeenCalled();
                }
            });
        });

        it('сбой отправки уведомления не меняет результат выгрузки', async () => {
            await withRequestContext(async () => {
                const { handler, notifier } = build(buildHappyPathMatcher());
                notifier.notifyManualUploaded.mockRejectedValue(
                    new Error('telegram'),
                );
                const command = new StartPriceImportCommand({
                    fileBase64: buildPriceListFileBase64(),
                    notifyResult: true,
                });
                await expect(handler.execute(command)).resolves.toEqual({
                    id: command.id,
                });
            });
        });
    });
});
