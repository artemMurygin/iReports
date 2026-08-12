import { CostChange } from './cost-change.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('CostChange', () => {
    it('создаёт изменение закупочной цены', () => {
        const change = CostChange.create({
            productId: 'ms-1',
            productName: 'Apple iPhone 16 Pro 256GB Black Titanium',
            oldCost: 80000,
            newCost: 82000,
        });

        expect(change.getProductId()).toBe('ms-1');
        expect(change.getProductName()).toBe(
            'Apple iPhone 16 Pro 256GB Black Titanium',
        );
        expect(change.getOldCost()).toBe(80000);
        expect(change.getNewCost()).toBe(82000);
        expect(change.hasChanged()).toBe(true);
    });

    it('oldCost может быть null (у товара ещё не было закупочной цены)', () => {
        const change = CostChange.create({
            productId: 'ms-1',
            productName: 'name',
            oldCost: null,
            newCost: 1000,
        });

        expect(change.getOldCost()).toBeNull();
        expect(change.hasChanged()).toBe(true);
    });

    it('hasChanged() = false, если цена не изменилась', () => {
        const change = CostChange.create({
            productId: 'ms-1',
            productName: 'name',
            oldCost: 1000,
            newCost: 1000,
        });

        expect(change.hasChanged()).toBe(false);
    });

    it('отклоняет пустой productId', () => {
        withRequestContext(() => {
            expect(() =>
                CostChange.create({
                    productId: '  ',
                    productName: 'name',
                    oldCost: null,
                    newCost: 100,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('отклоняет пустой productName', () => {
        withRequestContext(() => {
            expect(() =>
                CostChange.create({
                    productId: 'ms-1',
                    productName: '',
                    oldCost: null,
                    newCost: 100,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('отклоняет отрицательную oldCost', () => {
        withRequestContext(() => {
            expect(() =>
                CostChange.create({
                    productId: 'ms-1',
                    productName: 'name',
                    oldCost: -1,
                    newCost: 100,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('отклоняет отрицательную newCost', () => {
        withRequestContext(() => {
            expect(() =>
                CostChange.create({
                    productId: 'ms-1',
                    productName: 'name',
                    oldCost: 100,
                    newCost: -1,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });
});
