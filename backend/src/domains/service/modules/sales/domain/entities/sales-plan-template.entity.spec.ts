import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalesPlanTemplate } from './sales-plan-template.entity';

describe('SalesPlanTemplate', () => {
    const baseProps = {
        direction: 'service' as const,
        department: 1,
        turnover: 1_000_000,
        margin: 200_000,
    };

    it('создаёт шаблон с growthPercent по умолчанию 10%', () => {
        const template = withRequestContext(() =>
            SalesPlanTemplate.create(baseProps),
        );

        expect(template.growthPercent).toBe(10);
        expect(template.category).toBeNull();
        expect(template.orderTypeIds).toEqual([]);
    });

    it('принимает явно выбранные типы заказов', () => {
        const template = withRequestContext(() =>
            SalesPlanTemplate.create({ ...baseProps, orderTypeIds: [4, 5] }),
        );

        expect(template.orderTypeIds).toEqual([4, 5]);
    });

    it('принимает явный growthPercent и категорию', () => {
        const template = withRequestContext(() =>
            SalesPlanTemplate.create({
                ...baseProps,
                category: '7',
                growthPercent: 15,
            }),
        );

        expect(template.category).toBe('7');
        expect(template.growthPercent).toBe(15);
    });

    it('отклоняет отрицательный процент роста', () => {
        expect(() =>
            withRequestContext(() =>
                SalesPlanTemplate.create({ ...baseProps, growthPercent: -5 }),
            ),
        ).toThrow();
    });

    it('update() правит только переданные поля', () => {
        const template = withRequestContext(() =>
            SalesPlanTemplate.create(baseProps),
        );

        withRequestContext(() => template.update({ growthPercent: 20 }));

        expect(template.growthPercent).toBe(20);
        expect(template.turnover).toBe(baseProps.turnover);
        expect(template.margin).toBe(baseProps.margin);
        expect(template.orderTypeIds).toEqual([]);
    });

    it('update() правит orderTypeIds', () => {
        const template = withRequestContext(() =>
            SalesPlanTemplate.create({ ...baseProps, orderTypeIds: [1] }),
        );

        withRequestContext(() => template.update({ orderTypeIds: [7, 8] }));

        expect(template.orderTypeIds).toEqual([7, 8]);
    });
});
