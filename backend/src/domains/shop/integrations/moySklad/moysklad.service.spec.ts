import { MoyskladService } from './moysklad.service';
import type { MoyskladHttpService } from './moysklad.instance';

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
