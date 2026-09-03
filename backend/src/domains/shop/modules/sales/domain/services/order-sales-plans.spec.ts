import { withRequestContext } from '@/shared/testing/with-request-context';
import { orderShopSalesPlansByTemplate } from './order-sales-plans';
import { ShopSalesPlan } from '../entities/sales-plan.entity';
import { ShopSalesPlanTemplate } from '../entities/sales-plan-template.entity';

// Зеркало domains/service/modules/sales/domain/services/
// order-sales-plans.spec.ts (Фаза 1) — независимая копия для направления
// shop (Фаза 4, docs/sales-plan-row-drag-and-drop-reorder): подтверждает,
// что GetShopSalesPerformanceService/ListShopSalesPlansService (task item
// 3 этой фазы) отдают строки в правильном порядке и для direction: 'shop'.
describe('orderShopSalesPlansByTemplate', () => {
    const plan = (department: number, category: string | null) =>
        withRequestContext(() =>
            ShopSalesPlan.create({
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
            ShopSalesPlanTemplate.create({
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

        const ordered = orderShopSalesPlansByTemplate(
            [planA, planB, planC],
            [template(1, 'A', 2), template(1, 'B', 0), template(1, 'C', 1)],
        );

        expect(ordered.map((o) => o.plan.category)).toEqual(['B', 'C', 'A']);
        expect(ordered.map((o) => o.sortOrder)).toEqual([0, 1, 2]);
    });

    it('категория без связанного шаблона уходит в конец списка, а не в начало', () => {
        const planWithOrder = plan(1, 'A');
        const planWithoutTemplate = plan(1, 'B');

        const ordered = orderShopSalesPlansByTemplate(
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

        const ordered = orderShopSalesPlansByTemplate([planZ, planA], []);

        expect(ordered.map((o) => o.plan.category)).toEqual(['A', 'Z']);
        expect(ordered.every((o) => o.sortOrder === null)).toBe(true);
    });

    it('группировка по отделу сохраняется — sortOrder работает внутри отдела', () => {
        const dept2Low = plan(2, 'X');
        const dept1High = plan(1, 'Y');

        const ordered = orderShopSalesPlansByTemplate(
            [dept2Low, dept1High],
            [template(2, 'X', 0), template(1, 'Y', 99)],
        );

        expect(ordered.map((o) => o.plan.department)).toEqual([1, 2]);
    });

    it('строка "без категории" (category = null) находит свой шаблон по тому же сентинелу', () => {
        const planNoCategory = plan(1, null);

        const ordered = orderShopSalesPlansByTemplate(
            [planNoCategory],
            [template(1, null, 7)],
        );

        expect(ordered[0].sortOrder).toBe(7);
    });
});
