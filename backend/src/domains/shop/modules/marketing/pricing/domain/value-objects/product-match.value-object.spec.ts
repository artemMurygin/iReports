import { ProductMatch } from './product-match.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ProductMatch', () => {
    it('создаёт совпадение через LLM', () => {
        const match = ProductMatch.create({
            sourceRowName: 'Apple iPhone 16 Pro 256GB',
            sourcePrice: 99990,
            matchedProductId: 'ms-1',
            matchedProductName: 'Apple iPhone 16 Pro 256GB Black Titanium',
            method: 'llm',
            confidence: 0.87,
        });

        expect(match.getSourceRowName()).toBe('Apple iPhone 16 Pro 256GB');
        expect(match.getSourcePrice()).toBe(99990);
        expect(match.getMatchedProductId()).toBe('ms-1');
        expect(match.getMatchedProductName()).toBe(
            'Apple iPhone 16 Pro 256GB Black Titanium',
        );
        expect(match.getMethod()).toBe('llm');
        expect(match.getConfidence()).toBe(0.87);
        expect(match.isMatched()).toBe(true);
    });

    it('создаёт несопоставленную строку (method: "none")', () => {
        const match = ProductMatch.create({
            sourceRowName: 'Неизвестный товар',
            sourcePrice: null,
            matchedProductId: null,
            matchedProductName: null,
            method: 'none',
            confidence: 0,
        });

        expect(match.isMatched()).toBe(false);
        expect(match.getMatchedProductId()).toBeNull();
        expect(match.getMatchedProductName()).toBeNull();
    });

    it('sourcePrice может быть null (цена в прайсе не указана)', () => {
        const match = ProductMatch.create({
            sourceRowName: 'Apple AirPods Pro 3',
            sourcePrice: null,
            matchedProductId: 'ms-2',
            matchedProductName: 'Apple AirPods Pro 3',
            method: 'embedding',
            confidence: 1,
        });

        expect(match.getSourcePrice()).toBeNull();
    });

    it('отклоняет пустой sourceRowName', () => {
        withRequestContext(() => {
            expect(() =>
                ProductMatch.create({
                    sourceRowName: '  ',
                    sourcePrice: null,
                    matchedProductId: null,
                    matchedProductName: null,
                    method: 'none',
                    confidence: 0,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('отклоняет отрицательную sourcePrice', () => {
        withRequestContext(() => {
            expect(() =>
                ProductMatch.create({
                    sourceRowName: 'row',
                    sourcePrice: -1,
                    matchedProductId: null,
                    matchedProductName: null,
                    method: 'none',
                    confidence: 0,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it.each([-0.1, 1.1])(
        'отклоняет confidence вне диапазона [0, 1]: %s',
        (confidence) => {
            withRequestContext(() => {
                expect(() =>
                    ProductMatch.create({
                        sourceRowName: 'row',
                        sourcePrice: null,
                        matchedProductId: null,
                        matchedProductName: null,
                        method: 'none',
                        confidence,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        },
    );

    it('отклоняет method "none" с указанным matchedProductId', () => {
        withRequestContext(() => {
            expect(() =>
                ProductMatch.create({
                    sourceRowName: 'row',
                    sourcePrice: null,
                    matchedProductId: 'ms-1',
                    matchedProductName: null,
                    method: 'none',
                    confidence: 0,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it.each(['embedding', 'llm'] as const)(
        'отклоняет method "%s" без matchedProductId',
        (method) => {
            withRequestContext(() => {
                expect(() =>
                    ProductMatch.create({
                        sourceRowName: 'row',
                        sourcePrice: null,
                        matchedProductId: null,
                        matchedProductName: 'name',
                        method,
                        confidence: 0.5,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        },
    );

    it.each(['embedding', 'llm'] as const)(
        'отклоняет method "%s" без matchedProductName',
        (method) => {
            withRequestContext(() => {
                expect(() =>
                    ProductMatch.create({
                        sourceRowName: 'row',
                        sourcePrice: null,
                        matchedProductId: 'ms-1',
                        matchedProductName: null,
                        method,
                        confidence: 0.5,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        },
    );
});
