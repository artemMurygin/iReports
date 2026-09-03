import { withRequestContext } from '@/shared/testing/with-request-context';
import { EnsureSalesPlansForPeriodService } from './ensure-sales-plans-for-period.service';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

// Имитирует БД в памяти — findByDirectionAndPeriod читает то, что реально
// лежит в plans, insert реально в неё пишет. Так тесты идемпотентности и
// финального перечитывания (см. ensure()) проверяют настоящее поведение, а
// не то, что подложил мок.
describe('EnsureSalesPlansForPeriodService', () => {
    const buildService = (
        plans: SalesPlan[] = [],
        templates: SalesPlanTemplate[] = [],
    ) => {
        const store = new Map(plans.map((plan) => [plan.id, plan]));
        const insert = jest.fn((entity: SalesPlan) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        });
        const planRepo: SalesPlanRepositoryPort = {
            insert,
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: (direction, period) =>
                Promise.resolve(
                    [...store.values()].filter(
                        (plan) =>
                            plan.direction === direction &&
                            plan.period === period,
                    ),
                ),
        };
        const templateRepo: SalesPlanTemplateRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            findByScope: jest.fn(),
            findAll: jest.fn().mockResolvedValue(templates),
        };
        const service = new EnsureSalesPlansForPeriodService(
            planRepo,
            templateRepo,
        );
        return { service, insert, store };
    };

    it('растит план предыдущего месяца на growthPercent из шаблона той же комбинации', async () => {
        await withRequestContext(async () => {
            const previous = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const template = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                turnover: 0,
                margin: 0,
                growthPercent: 20,
            });
            const { service, insert } = buildService([previous], [template]);

            const result = await service.ensure('service', '2026-08');

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
            const previous = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                orderTypeIds: [1, 2],
                source: 'MANUAL',
            });
            const template = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                turnover: 0,
                margin: 0,
                orderTypeIds: [9],
                growthPercent: 20,
            });
            const { service, insert } = buildService([previous], [template]);

            const result = await service.ensure('service', '2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result[0].orderTypeIds).toEqual([1, 2]);
        });
    });

    it('без плана предыдущего месяца переносит orderTypeIds из шаблона', async () => {
        await withRequestContext(async () => {
            const template = SalesPlanTemplate.create({
                direction: 'service',
                department: 3,
                turnover: 500_000,
                margin: 100_000,
                orderTypeIds: [4, 5],
                growthPercent: 15,
            });
            const { service, insert } = buildService([], [template]);

            const result = await service.ensure('service', '2026-08');

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result[0].orderTypeIds).toEqual([4, 5]);
        });
    });

    it('без строки шаблона для комбинации использует growthPercent по умолчанию (10%)', async () => {
        await withRequestContext(async () => {
            const previous = SalesPlan.create({
                direction: 'service',
                department: 2,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service, insert } = buildService([previous], []);

            const result = await service.ensure('service', '2026-08');

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
            const template = SalesPlanTemplate.create({
                direction: 'service',
                department: 3,
                turnover: 500_000,
                margin: 100_000,
                growthPercent: 15,
            });
            const { service, insert } = buildService([], [template]);

            const result = await service.ensure('service', '2026-08');

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
            const previous = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const current = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 999,
                margin: 111,
                source: 'MANUAL',
            });
            current.approve(42);
            const template = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                turnover: 0,
                margin: 0,
                growthPercent: 20,
            });
            const { service, insert } = buildService(
                [previous, current],
                [template],
            );

            const first = await service.ensure('service', '2026-08');
            const second = await service.ensure('service', '2026-08');

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
            const previousDept1 = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-07',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'PREVIOUS_MONTH',
            });
            const templateDept2 = SalesPlanTemplate.create({
                direction: 'service',
                department: 2,
                turnover: 300_000,
                margin: 50_000,
                growthPercent: 10,
            });
            const { service, insert } = buildService(
                [previousDept1],
                [templateDept2],
            );

            const result = await service.ensure('service', '2026-08');

            expect(insert).toHaveBeenCalledTimes(2);
            const sources = result.map((plan) => plan.source).sort();
            expect(sources).toEqual(['PREVIOUS_MONTH', 'TEMPLATE']);
        });
    });

    it('ensureOrdered() сортирует по sortOrder шаблона, строку без шаблона — в конец', async () => {
        await withRequestContext(async () => {
            const planA = SalesPlan.create({
                direction: 'service',
                department: 1,
                category: 'A',
                period: '2026-08',
                turnover: 1,
                margin: 1,
                source: 'MANUAL',
            });
            const planB = SalesPlan.create({
                direction: 'service',
                department: 1,
                category: 'B',
                period: '2026-08',
                turnover: 1,
                margin: 1,
                source: 'MANUAL',
            });
            const templateA = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                category: 'A',
                turnover: 0,
                margin: 0,
                sortOrder: 5,
            });
            const { service } = buildService([planA, planB], [templateA]);

            const result = await service.ensureOrdered('service', '2026-08');

            expect(result.map((r) => r.plan.category)).toEqual(['A', 'B']);
            expect(result.map((r) => r.sortOrder)).toEqual([5, null]);
        });
    });
});
