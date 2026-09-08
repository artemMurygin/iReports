import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateSalesPlanOrderHandler } from './update-sales-plan-order.handler';
import { UpdateSalesPlanOrderCommand } from './update-sales-plan-order.command';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

describe('UpdateSalesPlanOrderHandler', () => {
    const buildHandler = (existing: SalesPlanTemplate[]) => {
        const store = new Map(existing.map((t) => [t.id, t]));
        const insert = jest.fn((entity: SalesPlanTemplate) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        });
        const update = jest.fn((entity: SalesPlanTemplate) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        });
        const findByScope = jest.fn((direction, department, category) =>
            Promise.resolve(
                [...store.values()].find(
                    (t) =>
                        t.direction === direction &&
                        t.department === department &&
                        t.category === category,
                ) ?? null,
            ),
        );
        const repo: SalesPlanTemplateRepositoryPort = {
            insert,
            update,
            findByScope,
            findAll: jest.fn(),
        };
        return {
            handler: new UpdateSalesPlanOrderHandler(repo),
            insert,
            update,
            store,
        };
    };

    it('меняет sortOrder уже существующей строки шаблона, не трогая её остальные поля', async () => {
        await withRequestContext(async () => {
            const existing = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                category: '10',
                turnover: 1_000_000,
                margin: 200_000,
                growthPercent: 15,
            });
            const { handler, insert, update, store } = buildHandler([existing]);

            const result = await handler.execute(
                new UpdateSalesPlanOrderCommand({
                    direction: 'service',
                    department: 1,
                    items: [{ category: '10', sortOrder: 3 }],
                }),
            );

            expect(insert).not.toHaveBeenCalled();
            expect(update).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                category: '10',
                turnover: 1_000_000,
                margin: 200_000,
                growthPercent: 15,
            });
            expect(store.get(existing.id)?.sortOrder).toBe(3);
        });
    });

    it('заводит новую строку шаблона (turnover/margin = 0) для категории без шаблона', async () => {
        await withRequestContext(async () => {
            const { handler, insert, update, store } = buildHandler([]);

            const result = await handler.execute(
                new UpdateSalesPlanOrderCommand({
                    direction: 'service',
                    department: 2,
                    items: [{ category: null, sortOrder: 1 }],
                }),
            );

            expect(update).not.toHaveBeenCalled();
            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                department: 2,
                category: null,
                turnover: 0,
                margin: 0,
            });
            expect(result[0].sortOrder).toBe(1);
            expect(store.size).toBe(1);
        });
    });

    it('обрабатывает несколько категорий одним батчем', async () => {
        await withRequestContext(async () => {
            const existing = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                category: '10',
                turnover: 500_000,
                margin: 100_000,
            });
            const { handler, insert, update } = buildHandler([existing]);

            const result = await handler.execute(
                new UpdateSalesPlanOrderCommand({
                    direction: 'service',
                    department: 1,
                    items: [
                        { category: '10', sortOrder: 0 },
                        { category: '11', sortOrder: 1 },
                    ],
                }),
            );

            expect(update).toHaveBeenCalledTimes(1);
            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(2);
            expect(result.map((r) => r.sortOrder)).toEqual([0, 1]);
        });
    });
});
