import { Logger } from '@nestjs/common';
import { MoyskladService } from './moysklad.service';
import type { MoyskladHttpService } from './moysklad.instance';

// delay() мокается на весь файл — тесты опроса асинхронной задачи (D5) не
// должны реально ждать интервал между попытками.
jest.mock('../../../../shared/delay', () => ({
    delay: jest.fn().mockResolvedValue(undefined),
}));

// Мок MoyskladHttpService.instance (axios), без реального HTTP — по
// образцу moysklad-cash-document.adapter.spec.ts.
function createHttpMock() {
    return { get: jest.fn() };
}

// spec: shop-turnover-report D2 — справочник складов (GET /entity/store),
// обычная постраничная выгрузка, как productFolders/employees.
describe('MoyskladService.fetchStores', () => {
    it('обходит все страницы справочника складов и отдаёт только id/name', async () => {
        const http = createHttpMock();
        http.get
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            id: 'store-1',
                            name: 'Склад на Тверской',
                            archived: false,
                            externalCode: 'ext-1',
                        },
                    ],
                    meta: { size: 2, limit: 1, offset: 0 },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            id: 'store-2',
                            name: 'Склад на Ленинском',
                            archived: false,
                            externalCode: 'ext-2',
                        },
                    ],
                    meta: { size: 2, limit: 1, offset: 1 },
                },
            });

        const service = new MoyskladService({
            instance: http,
        } as unknown as MoyskladHttpService);

        const pages: { id: string; name: string }[][] = [];
        for await (const batch of service.fetchStores()) {
            pages.push(batch);
        }

        expect(pages).toEqual([
            [{ id: 'store-1', name: 'Склад на Тверской' }],
            [{ id: 'store-2', name: 'Склад на Ленинском' }],
        ]);

        expect(http.get).toHaveBeenCalledTimes(2);
        const [firstUrl, firstConfig] = http.get.mock.calls[0] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(firstUrl).toBe('/entity/store');
        expect(firstConfig.params.offset).toBe(0);

        const [, secondConfig] = http.get.mock.calls[1] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(secondConfig.params.offset).toBe(1);
    });
});

// spec: shop-turnover-report D5 — почасовой снимок остатков через
// асинхронный отчёт "Остатки по складам". Контракт опроса задачи не
// подтверждён до конца документацией (design.md "Открытые вопросы") —
// тесты покрывают наиболее вероятный контракт (rows сразу / task href +
// опрос до готовности) и обязательный синхронный fallback.
describe('MoyskladService.fetchStockByStore (D5)', () => {
    const buildService = (http: { get: jest.Mock }) =>
        new MoyskladService({
            instance: http,
        } as unknown as MoyskladHttpService);

    it('возвращает строки сразу, если ответ на запуск задачи уже содержит rows', async () => {
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [
                    {
                        meta: {
                            href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                        },
                        stockByStore: [
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                                },
                                stock: 5,
                                price: 1000,
                            },
                        ],
                    },
                ],
            },
        });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchStockByStore()) {
            pages.push(batch);
        }

        expect(pages).toEqual([
            [
                {
                    meta: {
                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                    },
                    stockByStore: [
                        {
                            meta: {
                                href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                            },
                            stock: 5,
                            price: 1000,
                        },
                    ],
                },
            ],
        ]);
        expect(http.get).toHaveBeenCalledTimes(1);
        const [url, config] = http.get.mock.calls[0] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(url).toBe('/report/stock/bystore');
        expect(config.params).toMatchObject({
            async: true,
            groupBy: 'product',
        });
    });

    it('опрашивает задачу по её ссылке до готовности и возвращает финальный результат', async () => {
        const http = createHttpMock();
        const taskHref =
            'https://api.moysklad.ru/api/remap/1.2/report/stock/bystore?async=true&id=task-1';
        http.get
            .mockResolvedValueOnce({
                data: { meta: { href: taskHref, state: 'Pending' } },
            })
            .mockResolvedValueOnce({ data: { meta: { state: 'Pending' } } })
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            meta: {
                                href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                            },
                            stockByStore: [],
                        },
                    ],
                },
            });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchStockByStore()) {
            pages.push(batch);
        }

        expect(pages).toEqual([
            [
                {
                    meta: {
                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                    },
                    stockByStore: [],
                },
            ],
        ]);
        expect(http.get).toHaveBeenCalledTimes(3);
        expect(http.get).toHaveBeenNthCalledWith(2, taskHref);
        expect(http.get).toHaveBeenNthCalledWith(3, taskHref);
    });

    it('переключается на синхронную постраничную выгрузку, если задача завершилась ошибкой', async () => {
        const http = createHttpMock();
        http.get
            .mockResolvedValueOnce({
                data: {
                    meta: {
                        href: 'https://api.moysklad.ru/api/remap/1.2/report/stock/bystore?async=true&id=task-2',
                        state: 'Error',
                    },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            meta: {
                                href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                            },
                            stockByStore: [],
                        },
                    ],
                    meta: { size: 1, limit: 1000, offset: 0 },
                },
            });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchStockByStore()) {
            pages.push(batch);
        }

        expect(pages).toHaveLength(1);
        const [secondUrl, secondConfig] = http.get.mock.calls[1] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(secondUrl).toBe('/report/stock/bystore');
        expect(secondConfig.params.async).toBeUndefined();
        expect(secondConfig.params.offset).toBe(0);
    });

    it('переключается на синхронный fallback, если опрос задачи превысил лимит попыток', async () => {
        const http = createHttpMock();
        const taskHref =
            'https://api.moysklad.ru/api/remap/1.2/report/stock/bystore?async=true&id=task-3';
        http.get.mockImplementation(
            (url: string, config?: { params?: Record<string, unknown> }) => {
                if (url === '/report/stock/bystore' && config?.params?.async) {
                    return Promise.resolve({
                        data: { meta: { href: taskHref, state: 'Pending' } },
                    });
                }
                if (url === taskHref) {
                    return Promise.resolve({
                        data: { meta: { state: 'Pending' } },
                    });
                }
                return Promise.resolve({
                    data: {
                        rows: [
                            {
                                meta: {
                                    href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                                },
                                stockByStore: [],
                            },
                        ],
                        meta: { size: 1, limit: 1000, offset: 0 },
                    },
                });
            },
        );
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchStockByStore()) {
            pages.push(batch);
        }

        expect(pages).toHaveLength(1);
        const pollAttempts = http.get.mock.calls.filter(
            ([url]: [string]) => url === taskHref,
        ).length;
        expect(pollAttempts).toBeGreaterThan(1);
    });
});

// spec: fix-shop-turnover-historical-stock-cost D1, шаг 1 — обнаружение
// товаров с остатком на конец периода через account-wide отчёт "Обороты"
// (см. design.md D1/D2: momentFrom — фиксированный якорь, не связан с
// отчётным месяцем; withoutTurnover=true передаётся всегда, хотя эмпирически
// не влияет на результат — см. design.md Context).
describe('MoyskladService.fetchTurnoverAllAt (D1)', () => {
    const buildService = (http: { get: jest.Mock }) =>
        new MoyskladService({
            instance: http,
        } as unknown as MoyskladHttpService);

    it('запрашивает /report/turnover/all с momentFrom/momentTo/withoutTurnover и парсит строки', async () => {
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [
                    {
                        assortment: {
                            meta: {
                                href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                                type: 'product',
                            },
                        },
                        onPeriodEnd: { quantity: 5, sum: 12345 },
                    },
                ],
                meta: { size: 1, limit: 1000, offset: 0 },
            },
        });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchTurnoverAllAt(
            new Date('2020-01-01T00:00:00.000Z'),
            new Date('2026-08-31T23:59:59.999Z'),
        )) {
            pages.push(batch);
        }

        expect(pages).toEqual([
            [
                {
                    assortment: {
                        meta: {
                            href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                            type: 'product',
                        },
                    },
                    onPeriodEnd: { quantity: 5, sum: 12345 },
                },
            ],
        ]);

        expect(http.get).toHaveBeenCalledTimes(1);
        const [url, config] = http.get.mock.calls[0] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(url).toBe('/report/turnover/all');
        expect(config.params).toMatchObject({
            momentFrom: '2020-01-01 00:00:00',
            momentTo: '2026-08-31 23:59:59',
            withoutTurnover: 'true',
        });
    });

    it('обходит все страницы ответа (offset/limit)', async () => {
        const http = createHttpMock();
        http.get
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            assortment: {
                                meta: {
                                    href: '.../product/p1',
                                    type: 'product',
                                },
                            },
                            onPeriodEnd: { quantity: 1, sum: 100 },
                        },
                    ],
                    meta: { size: 2, limit: 1, offset: 0 },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            assortment: {
                                meta: {
                                    href: '.../product/p2',
                                    type: 'product',
                                },
                            },
                            onPeriodEnd: { quantity: 2, sum: 200 },
                        },
                    ],
                    meta: { size: 2, limit: 1, offset: 1 },
                },
            });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchTurnoverAllAt(
            new Date('2020-01-01T00:00:00.000Z'),
            new Date('2026-08-31T23:59:59.999Z'),
        )) {
            pages.push(batch);
        }

        expect(pages).toHaveLength(2);
        const [, secondConfig] = http.get.mock.calls[1] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(secondConfig.params.offset).toBe(1);
    });

    it('строка без onPeriodEnd не проходит валидацию схемы', async () => {
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [
                    {
                        assortment: {
                            meta: { href: '.../product/p1', type: 'product' },
                        },
                    },
                ],
                meta: { size: 1, limit: 1000, offset: 0 },
            },
        });
        const service = buildService(http);

        await expect(async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- дренаж генератора, ожидаем ошибку до первого yield
            for await (const _batch of service.fetchTurnoverAllAt(
                new Date('2020-01-01T00:00:00.000Z'),
                new Date('2026-08-31T23:59:59.999Z'),
            )) {
                // no-op — ожидаем ошибку до первого yield
            }
        }).rejects.toThrow();
    });
});

// spec: fix-shop-turnover-historical-stock-cost D1, шаг 2 — разбивка по
// складам для ОДНОГО товара (см. design.md Risks: `filter=product=` не
// работает для `variant`, поэтому имя параметра фильтра зависит от
// `assortment.meta.type` строки, полученной на шаге 1).
describe('MoyskladService.fetchTurnoverByStoreForProduct (D1)', () => {
    const buildService = (http: { get: jest.Mock }) =>
        new MoyskladService({
            instance: http,
        } as unknown as MoyskladHttpService);

    const productHref =
        'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1';

    it('строит filter=product=<href> для assortmentType "product" и мапит stockByStore[]', async () => {
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [
                    {
                        assortment: {
                            meta: { href: productHref, type: 'product' },
                        },
                        stockByStore: [
                            {
                                store: {
                                    meta: {
                                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
                                    },
                                },
                                onPeriodEnd: { quantity: 3, sum: 1500 },
                            },
                        ],
                    },
                ],
            },
        });
        const service = buildService(http);

        const result = await service.fetchTurnoverByStoreForProduct(
            productHref,
            'product',
            new Date('2020-01-01T00:00:00.000Z'),
            new Date('2026-08-31T23:59:59.999Z'),
        );

        expect(result).toEqual([
            { warehouseId: 'store-1', quantity: 3, costSum: 1500 },
        ]);

        expect(http.get).toHaveBeenCalledTimes(1);
        const [url, config] = http.get.mock.calls[0] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(url).toBe('/report/turnover/bystore');
        expect(config.params.filter).toBe(`product=${productHref}`);
        expect(config.params).toMatchObject({
            momentFrom: '2020-01-01 00:00:00',
            momentTo: '2026-08-31 23:59:59',
            withoutTurnover: 'true',
        });
    });

    it('строит filter=variant=<href> для assortmentType "variant"', async () => {
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({ data: { rows: [] } });
        const service = buildService(http);

        await service.fetchTurnoverByStoreForProduct(
            productHref,
            'variant',
            new Date('2020-01-01T00:00:00.000Z'),
            new Date('2026-08-31T23:59:59.999Z'),
        );

        const [, config] = http.get.mock.calls[0] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(config.params.filter).toBe(`variant=${productHref}`);
    });

    it('для неизвестного assortmentType логирует warn и не обращается к API', async () => {
        const warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation();
        const http = createHttpMock();
        const service = buildService(http);

        const result = await service.fetchTurnoverByStoreForProduct(
            productHref,
            'bundle',
            new Date('2020-01-01T00:00:00.000Z'),
            new Date('2026-08-31T23:59:59.999Z'),
        );

        expect(result).toEqual([]);
        expect(http.get).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
