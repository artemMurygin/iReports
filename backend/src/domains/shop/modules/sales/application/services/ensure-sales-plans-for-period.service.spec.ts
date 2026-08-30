import { withRequestContext } from '@/shared/testing/with-request-context';
import { EnsureShopSalesPlansForPeriodService } from './ensure-sales-plans-for-period.service';
import type { ShopSalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { ShopSalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { ShopSalesPlan } from '../../domain/entities/sales-plan.entity';
import { ShopSalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

// Зеркало domains/service/modules/sales/application/services/
// ensure-sales-plans-for-period.service.spec.ts (Фаза 7
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop, без параметра direction. Имитирует БД в памяти —
// findByPeriod читает то, что реально лежит в plans, insert реально в неё
// пишет.
describe('EnsureShopSalesPlansForPeriodService', () => {
    const buildService = (
        plans: ShopSalesPlan[] = [],
        templates: ShopSalesPlanTemplate[] = [],
    ) => {
        const store = new Map(plans.map((plan) => [plan.id, plan]));
        const insert = jest.fn((entity: ShopSalesPlan) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        });
        const planRepo: ShopSalesPlanRepositoryPort = {
            insert,
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByPeriod: (period) =>
                Promise.resolve(
                    [...store.values()].filter(
                        (plan) => plan.period === period,
                    ),
                ),
        };
        const templateRepo: ShopSalesPlanTemplateRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            findByScope: jest.fn(),
            findAll: jest.fn().mockResolvedValue(templates),
        };
        const service = new EnsureShopSalesPlansForPeriodService(
            planRepo,
            templateRepo,
        );
        return { service, insert, store };
    };

    it('растит план предыдущего месяца на growthPercent из шаблона той же комбинации', async () => {
        await withRequestContext(async () => {
            const previous = ShopSalesPlan.create({
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const template = ShopSalesPlanTemplate.create({
                department: 1,
                turnover: 0,
                margin: 0,
                growthPercent: 20,
            });
            const { service, insert } = buildService([previous], [template]);

            const result = await service.ensure('2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                source: 'PREVIOUS_MONTH',
                status: 'CREATED',
                turnover: 1_200_000,
                margin: 240_000,
            });
        });
    });

    it('переносит orderTypeIds из плана предыдущего месяца, а не из шаблона', async () => {
        await withRequestContext(async () => {
            const previous = ShopSalesPlan.create({
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                orderTypeIds: [1, 2],
                source: 'MANUAL',
            });
            const template = ShopSalesPlanTemplate.create({
                department: 1,
                turnover: 0,
                margin: 0,
                orderTypeIds: [9],
                growthPercent: 20,
            });
            const { service, insert } = buildService([previous], [template]);

            const result = await service.ensure('2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result[0].orderTypeIds).toEqual([1, 2]);
        });
    });

    it('без плана предыдущего месяца переносит orderTypeIds из шаблона', async () => {
        await withRequestContext(async () => {
            const template = ShopSalesPlanTemplate.create({
                department: 3,
                turnover: 500_000,
                margin: 100_000,
                orderTypeIds: [4, 5],
                growthPercent: 15,
            });
            const { service, insert } = buildService([], [template]);

            const result = await service.ensure('2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result[0].orderTypeIds).toEqual([4, 5]);
        });
    });

    it('без строки шаблона для комбинации использует growthPercent по умолчанию (10%)', async () => {
        await withRequestContext(async () => {
            const previous = ShopSalesPlan.create({
                department: 2,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service, insert } = buildService([previous], []);

            const result = await service.ensure('2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result[0]).toMatchObject({
                source: 'PREVIOUS_MONTH',
                turnover: 1_100_000,
                margin: 220_000,
            });
        });
    });

    it('создаёт строку из шаблона без надбавки, если плана предыдущего месяца нет', async () => {
        await withRequestContext(async () => {
            const template = ShopSalesPlanTemplate.create({
                department: 3,
                turnover: 500_000,
                margin: 100_000,
                growthPercent: 15,
            });
            const { service, insert } = buildService([], [template]);

            const result = await service.ensure('2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result[0]).toMatchObject({
                source: 'TEMPLATE',
                turnover: 500_000,
                margin: 100_000,
            });
        });
    });

    it('не создаёт дублей и не трогает APPROVED/MANUAL строки при повторном запуске', async () => {
        await withRequestContext(async () => {
            const previous = ShopSalesPlan.create({
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const current = ShopSalesPlan.create({
                department: 1,
                period: '2026-08',
                turnover: 999,
                margin: 111,
                source: 'MANUAL',
            });
            current.approve(42);
            const template = ShopSalesPlanTemplate.create({
                department: 1,
                turnover: 0,
                margin: 0,
                growthPercent: 20,
            });
            const { service, insert } = buildService(
                [previous, current],
                [template],
            );

            const first = await service.ensure('2026-08');
            const second = await service.ensure('2026-08');

            expect(insert).not.toHaveBeenCalled();
            expect(first).toHaveLength(1);
            expect(second).toHaveLength(1);
            expect(second[0]).toMatchObject({
                id: current.id,
                status: 'APPROVED',
                source: 'MANUAL',
                turnover: 999,
                margin: 111,
            });
        });
    });

    it('достраивает независимо несколько отсутствующих комбинаций за один вызов', async () => {
        await withRequestContext(async () => {
            const previousDept1 = ShopSalesPlan.create({
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'PREVIOUS_MONTH',
            });
            const templateDept2 = ShopSalesPlanTemplate.create({
                department: 2,
                turnover: 300_000,
                margin: 50_000,
                growthPercent: 10,
            });
            const { service, insert } = buildService(
                [previousDept1],
                [templateDept2],
            );

            const result = await service.ensure('2026-08');

            expect(insert).toHaveBeenCalledTimes(2);
            const sources = result.map((plan) => plan.source).sort();
            expect(sources).toEqual(['PREVIOUS_MONTH', 'TEMPLATE']);
        });
    });
});
