import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalesPlanScope } from './sales-plan-scope.value-object';

describe('SalesPlanScope', () => {
    it('создаёт область видимости с категорией и без', () => {
        const withCategory = SalesPlanScope.create('service', 1, '5');
        const withoutCategory = SalesPlanScope.create('service', 1, null);

        expect(withCategory.getCategory()).toBe('5');
        expect(withoutCategory.getCategory()).toBeNull();
        expect(withCategory.getDirection()).toBe('service');
        expect(withCategory.getDepartment()).toBe(1);
    });

    it('отклоняет недопустимое направление', () => {
        expect(() =>
            withRequestContext(() =>
                SalesPlanScope.create('opt' as never, 1, null),
            ),
        ).toThrow();
    });

    it('отклоняет пустой отдел', () => {
        expect(() =>
            withRequestContext(() => SalesPlanScope.create('service', 0, null)),
        ).toThrow();
    });
});
