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

// spec: shop-turnover-report D5.1 — легаси бэкфилл истории остатков.
// Контракт эндпоинта (фильтр stockMoment/stockStore, пагинация) и имена
// полей строки подтверждены реальным ответом API: остаток — `stock` (шт.),
// себестоимость единицы — `buyPrice.value` (коп., объект `{ value,
// currency }`, НЕ плоское поле `price`) — тесты покрывают и штатный разбор
// (stock/buyPrice.value), и запасной путь с логированием.
describe('MoyskladService.fetchAssortmentStockAt (D5.1)', () => {
    const buildService = (http: { get: jest.Mock }) =>
        new MoyskladService({
            instance: Object.assign(http, {
                defaults: { baseURL: 'https://api.moysklad.ru/api/remap/1.2' },
            }),
        } as unknown as MoyskladHttpService);

    it('строит фильтр stockMoment/stockStore и парсит остаток/себестоимость из stock/buyPrice.value', async () => {
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [
                    {
                        meta: {
                            href: 'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                        },
                        stock: 7,
                        buyPrice: { value: 500 },
                    },
                ],
                meta: { size: 1, limit: 1000, offset: 0 },
            },
        });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchAssortmentStockAt(
            new Date('2026-08-31T23:59:59.999Z'),
            'store-1',
        )) {
            pages.push(batch);
        }

        expect(pages).toEqual([
            [
                {
                    productHref:
                        'https://api.moysklad.ru/api/remap/1.2/entity/product/product-1',
                    quantity: 7,
                    costSum: 3500,
                },
            ],
        ]);

        const [url, config] = http.get.mock.calls[0] as [
            string,
            { params: Record<string, unknown> },
        ];
        expect(url).toBe('/entity/assortment');
        expect(config.params.filter).toBe(
            'stockMoment=2026-08-31 23:59:59;stockStore=https://api.moysklad.ru/api/remap/1.2/entity/store/store-1',
        );
        expect(config.params.groupBy).toBe('product');
    });

    it('обходит все страницы ответа (offset/limit)', async () => {
        const http = createHttpMock();
        http.get
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            meta: { href: '.../product/p1' },
                            stock: 1,
                            buyPrice: { value: 100 },
                        },
                    ],
                    meta: { size: 2, limit: 1, offset: 0 },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    rows: [
                        {
                            meta: { href: '.../product/p2' },
                            stock: 2,
                            buyPrice: { value: 200 },
                        },
                    ],
                    meta: { size: 2, limit: 1, offset: 1 },
                },
            });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchAssortmentStockAt(
            new Date('2026-08-31T23:59:59.999Z'),
            'store-1',
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

    it('при отсутствии поля "stock" использует "quantity" и логирует предупреждение', async () => {
        const warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation();
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [
                    {
                        meta: { href: '.../product/p1' },
                        quantity: 4,
                        buyPrice: { value: 500 },
                    },
                ],
                meta: { size: 1, limit: 1000, offset: 0 },
            },
        });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchAssortmentStockAt(
            new Date('2026-08-31T23:59:59.999Z'),
            'store-1',
        )) {
            pages.push(batch);
        }

        expect(pages[0][0]).toMatchObject({ quantity: 4, costSum: 2000 });
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('при отсутствии полей остатка и себестоимости отдаёт нули и логирует предупреждения', async () => {
        const warnSpy = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation();
        const http = createHttpMock();
        http.get.mockResolvedValueOnce({
            data: {
                rows: [{ meta: { href: '.../product/p1' } }],
                meta: { size: 1, limit: 1000, offset: 0 },
            },
        });
        const service = buildService(http);

        const pages: unknown[][] = [];
        for await (const batch of service.fetchAssortmentStockAt(
            new Date('2026-08-31T23:59:59.999Z'),
            'store-1',
        )) {
            pages.push(batch);
        }

        expect(pages[0][0]).toMatchObject({ quantity: 0, costSum: 0 });
        expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        warnSpy.mockRestore();
    });
});
