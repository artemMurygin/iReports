import { withRequestContext } from '@/shared/testing/with-request-context';
import { orderSalesPlansByTemplate } from './order-sales-plans';
import { SalesPlan } from '../entities/sales-plan.entity';
import { SalesPlanTemplate } from '../entities/sales-plan-template.entity';

describe('orderSalesPlansByTemplate', () => {
    const plan = (department: number, category: string | null) =>
        withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department,
                category,
                period: '2026-09',
                turnover: 100,
                margin: 10,
                source: 'MANUAL',
            }),
        );

    const template = (
        department: number,
        category: string | null,
        sortOrder: number,
    ) =>
        withRequestContext(() =>
            SalesPlanTemplate.create({
                direction: 'service',
                department,
                category,
                turnover: 1,
                margin: 1,
                sortOrder,
            }),
        );

    it('сортирует строки по sortOrder связанного шаблона', () => {
        const planA = plan(1, 'A');
        const planB = plan(1, 'B');
        const planC = plan(1, 'C');

        const ordered = orderSalesPlansByTemplate(
            [planA, planB, planC],
            [template(1, 'A', 2), template(1, 'B', 0), template(1, 'C', 1)],
        );

        expect(ordered.map((o) => o.plan.category)).toEqual(['B', 'C', 'A']);
        expect(ordered.map((o) => o.sortOrder)).toEqual([0, 1, 2]);
    });

    it('категория без связанного шаблона уходит в конец списка, а не в начало', () => {
        const planWithOrder = plan(1, 'A');
        const planWithoutTemplate = plan(1, 'B');

        const ordered = orderSalesPlansByTemplate(
            [planWithoutTemplate, planWithOrder],
            [template(1, 'A', 5)],
        );

        expect(ordered.map((o) => o.plan.category)).toEqual(['A', 'B']);
        expect(ordered[0].sortOrder).toBe(5);
        expect(ordered[1].sortOrder).toBeNull();
    });

    it('несколько категорий без шаблона сортируются между собой по categoryId', () => {
        const planZ = plan(1, 'Z');
        const planA = plan(1, 'A');

        const ordered = orderSalesPlansByTemplate([planZ, planA], []);

        expect(ordered.map((o) => o.plan.category)).toEqual(['A', 'Z']);
        expect(ordered.every((o) => o.sortOrder === null)).toBe(true);
    });

    it('группировка по отделу сохраняется — sortOrder работает внутри отдела', () => {
        const dept2Low = plan(2, 'X');
        const dept1High = plan(1, 'Y');

        const ordered = orderSalesPlansByTemplate(
            [dept2Low, dept1High],
            [template(2, 'X', 0), template(1, 'Y', 99)],
        );

        expect(ordered.map((o) => o.plan.department)).toEqual([1, 2]);
    });

    it('строка "без категории" (category = null) находит свой шаблон по тому же сентинелу', () => {
        const planNoCategory = plan(1, null);

        const ordered = orderSalesPlansByTemplate(
            [planNoCategory],
            [template(1, null, 7)],
        );

        expect(ordered[0].sortOrder).toBe(7);
    });
});
