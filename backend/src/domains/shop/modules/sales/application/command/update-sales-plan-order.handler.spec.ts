import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateShopSalesPlanOrderHandler } from './update-sales-plan-order.handler';
import { UpdateShopSalesPlanOrderCommand } from './update-sales-plan-order.command';
import type { ShopSalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { ShopSalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

// Зеркало domains/service/modules/sales/application/command/
// update-sales-plan-order.handler.spec.ts (Фаза 1) — независимая копия для
// направления shop (Фаза 4, docs/sales-plan-row-drag-and-drop-reorder).
describe('UpdateShopSalesPlanOrderHandler', () => {
    const buildHandler = (existing: ShopSalesPlanTemplate[]) => {
        const store = new Map(existing.map((t) => [t.id, t]));
        const insert = jest.fn((entity: ShopSalesPlanTemplate) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        });
        const update = jest.fn((entity: ShopSalesPlanTemplate) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        });
        const findByScope = jest.fn((department, category) =>
            Promise.resolve(
                [...store.values()].find(
                    (t) =>
                        t.department === department && t.category === category,
                ) ?? null,
            ),
        );
        const repo: ShopSalesPlanTemplateRepositoryPort = {
            insert,
            update,
            findByScope,
            findAll: jest.fn(),
        };
        return {
            handler: new UpdateShopSalesPlanOrderHandler(repo),
            insert,
            update,
            store,
        };
    };

    it('меняет sortOrder уже существующей строки шаблона, не трогая её остальные поля', async () => {
        await withRequestContext(async () => {
            const existing = ShopSalesPlanTemplate.create({
                department: 1,
                category: '10',
                turnover: 1_000_000,
                margin: 200_000,
                growthPercent: 15,
            });
            const { handler, insert, update, store } = buildHandler([existing]);

            const result = await handler.execute(
                new UpdateShopSalesPlanOrderCommand({
                    department: 1,
                    items: [{ category: '10', sortOrder: 3 }],
                }),
            );

            expect(insert).not.toHaveBeenCalled();
            expect(update).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                direction: 'shop',
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
                new UpdateShopSalesPlanOrderCommand({
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
            const existing = ShopSalesPlanTemplate.create({
                department: 1,
                category: '10',
                turnover: 500_000,
                margin: 100_000,
            });
            const { handler, insert, update } = buildHandler([existing]);

            const result = await handler.execute(
                new UpdateShopSalesPlanOrderCommand({
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

    // Закрытый расчётный период не блокирует переупорядочивание (см.
    // обоснование в комментарии у execute() в хендлере) — на уровне
    // хендлера это проявляется как отсутствие какой-либо
    // AccountingPeriod-зависимости в конструкторе вообще: хендлер строится
    // здесь только из репозитория шаблона и успешно выполняет команду без
    // какого-либо стороннего "период открыт?"-запроса.
    it('выполняет команду без обращения к состоянию расчётного периода (сознательное решение Фазы 4)', async () => {
        await withRequestContext(async () => {
            const { handler, store } = buildHandler([]);

            await handler.execute(
                new UpdateShopSalesPlanOrderCommand({
                    department: 3,
                    items: [{ category: 'closed-period-scope', sortOrder: 0 }],
                }),
            );

            expect(store.size).toBe(1);
        });
    });
});
