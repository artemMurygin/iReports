import type { AiService } from '@/integrations/ai/ai.service';
import { AiProductMatcherAdapter } from './ai-product-matcher.adapter';

function buildFakeAi(response: string): { ai: AiService; ask: jest.Mock } {
    const ask = jest.fn().mockResolvedValue(response);
    return { ai: { ask } as unknown as AiService, ask };
}

describe('AiProductMatcherAdapter', () => {
    describe('match', () => {
        it('мапит полные пары ответа AI в ProductMatch(method: "llm")', async () => {
            const { ai } = buildFakeAi(
                JSON.stringify([
                    {
                        system_id: 'ms-1',
                        system_name: 'MacBook Air 13 Midnight',
                        price_name: 'MacBook Air 13" Midnight',
                        price: 120000,
                    },
                ]),
            );
            const adapter = new AiProductMatcherAdapter(ai);

            const matches = await adapter.match(
                'MacBook',
                [{ name: 'MacBook Air 13" Midnight', price: 120000 }],
                [{ id: 'ms-1', name: 'MacBook Air 13 Midnight' }],
            );

            expect(matches).toHaveLength(1);
            expect(matches[0].getMatchedProductId()).toBe('ms-1');
            expect(matches[0].getMethod()).toBe('llm');
            expect(matches[0].getSourcePrice()).toBe(120000);
        });

        it('отбрасывает неполные позиции (нет пары price_name/system_id)', async () => {
            const { ai } = buildFakeAi(
                JSON.stringify([
                    {
                        system_id: 'ms-1',
                        system_name: 'MacBook Air 13 Midnight',
                        price_name: null,
                        price: null,
                    },
                ]),
            );
            const adapter = new AiProductMatcherAdapter(ai);

            const matches = await adapter.match(
                'MacBook',
                [],
                [{ id: 'ms-1', name: 'MacBook Air 13 Midnight' }],
            );

            expect(matches).toEqual([]);
        });

        it('несуществующий id из ответа AI заменяется на id товара каталога с тем же названием', async () => {
            const { ai } = buildFakeAi(
                JSON.stringify([
                    {
                        // Искажённый сегмент UUID (127e вместо b696) — реальный случай 06.10.2026
                        system_id: '6d677979-127e-11f1-0a80-081a0017b05c',
                        system_name:
                            'Apple Watch Series 12 GPS 46mm Space Gray',
                        price_name: 'Apple Watch S12 46mm Space Gray',
                        price: 40500,
                    },
                ]),
            );
            const adapter = new AiProductMatcherAdapter(ai);
            const warn = jest
                .spyOn(adapter['logger'], 'warn')
                .mockImplementation(() => undefined);

            const matches = await adapter.match(
                'Watch',
                [{ name: 'Apple Watch S12 46mm Space Gray', price: 40500 }],
                [
                    { id: 'other', name: 'Apple Watch Series 11 GPS 42mm' },
                    {
                        id: '6d677979-b696-11f1-0a80-081a0017b05c',
                        name: 'Apple Watch Series 12 GPS 46mm  Space Gray ',
                    },
                ],
            );

            expect(matches).toHaveLength(1);
            expect(matches[0].getMatchedProductId()).toBe(
                '6d677979-b696-11f1-0a80-081a0017b05c',
            );
            expect(matches[0].getMatchedProductName()).toBe(
                'Apple Watch Series 12 GPS 46mm  Space Gray ',
            );
            expect(warn).toHaveBeenCalledWith(
                expect.objectContaining({ count: 1 }),
                expect.stringContaining('восстановлен по точному названию'),
            );
        });

        it('позиция с несуществующим id, не найденная и по названию, отбрасывается с предупреждением', async () => {
            const { ai } = buildFakeAi(
                JSON.stringify([
                    {
                        system_id: 'ms-1',
                        system_name: 'MacBook Air 13 Midnight',
                        price_name: 'MacBook Air 13" Midnight',
                        price: 120000,
                    },
                    {
                        system_id: 'ghost-id',
                        system_name: 'Выдуманный товар',
                        price_name: 'MacBook Pro 14',
                        price: 200000,
                    },
                ]),
            );
            const adapter = new AiProductMatcherAdapter(ai);
            const warn = jest
                .spyOn(adapter['logger'], 'warn')
                .mockImplementation(() => undefined);

            const matches = await adapter.match(
                'MacBook',
                [
                    { name: 'MacBook Air 13" Midnight', price: 120000 },
                    { name: 'MacBook Pro 14', price: 200000 },
                ],
                [{ id: 'ms-1', name: 'MacBook Air 13 Midnight' }],
            );

            expect(matches.map((m) => m.getMatchedProductId())).toEqual([
                'ms-1',
            ]);
            expect(warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    count: 1,
                    rejected: [
                        expect.stringContaining(
                            '"MacBook Pro 14" -> [ghost-id]',
                        ),
                    ],
                }),
                expect.stringContaining(
                    'Отброшены позиции с несуществующим id товара',
                ),
            );
        });

        it('бросает исключение, если ответ AI не распарсился как JSON-массив', async () => {
            const { ai } = buildFakeAi('не JSON');
            const adapter = new AiProductMatcherAdapter(ai);

            await expect(adapter.match('iPhone', [], [])).rejects.toThrow();
        });
    });

    describe('formatProductNames', () => {
        it('возвращает [] для пустого списка без обращения к AI', async () => {
            const { ai, ask } = buildFakeAi('[]');
            const adapter = new AiProductMatcherAdapter(ai);

            const result = await adapter.formatProductNames([]);

            expect(result).toEqual([]);
            expect(ask).not.toHaveBeenCalled();
        });

        it('парсит JSON-массив отформатированных названий', async () => {
            const { ai } = buildFakeAi(
                JSON.stringify([
                    'Apple MacBook Air 13" Midnight (M5, 16GB, 512GB)',
                ]),
            );
            const adapter = new AiProductMatcherAdapter(ai);

            const result = await adapter.formatProductNames([
                'macbook air 13 midnight',
            ]);

            expect(result).toEqual([
                'Apple MacBook Air 13" Midnight (M5, 16GB, 512GB)',
            ]);
        });

        it('при непарсящемся ответе возвращает исходные названия', async () => {
            const { ai } = buildFakeAi('не JSON');
            const adapter = new AiProductMatcherAdapter(ai);

            const result = await adapter.formatProductNames(['исходное имя']);

            expect(result).toEqual(['исходное имя']);
        });
    });
});
