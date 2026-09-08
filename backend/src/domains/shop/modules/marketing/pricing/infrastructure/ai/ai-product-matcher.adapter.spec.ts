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
