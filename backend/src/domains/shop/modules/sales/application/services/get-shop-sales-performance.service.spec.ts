import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { EnsureSalesPlansForPeriodService } from '@/domains/service/modules/sales/application/services/ensure-sales-plans-for-period.service';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanTemplateRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import { GetShopSalesPerformanceService } from './get-shop-sales-performance.service';
import type { ShopSalesFactSourcePort } from '../ports/shop-sales-fact-source.port';

// Имитирует БД в памяти для плана (как в get-sales-performance.service.spec.ts
// направления service) и подставляет фейковый источник ERP-факта магазина —
// сам сценарий проверяет сборку ShopSalesPerformance, а не устройство
// репозиториев.
describe('GetShopSalesPerformanceService', () => {
    const buildService = (
        plans: SalesPlan[],
        facts: {
            department: number;
            category: string | null;
            turnover: number;
            margin: number;
            cost: number;
            quantity: number;
        }[],
    ) => {
        const store = new Map(plans.map((plan) => [plan.id, plan]));
        const planRepo: SalesPlanRepositoryPort = {
            insert: jest.fn((entity: SalesPlan) => {
                store.set(entity.id, entity);
                return Promise.resolve();
            }),
            update: jest.fn((entity: SalesPlan) => {
                store.set(entity.id, entity);
                return Promise.resolve();
            }),
            delete: jest.fn((id: string) => {
                store.delete(id);
                return Promise.resolve();
            }),
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
            findAll: jest.fn().mockResolvedValue([]),
        };
        const aggregate = jest.fn().mockResolvedValue(facts);
        const factSource: ShopSalesFactSourcePort = { aggregate };
        const ensureSalesPlans = new EnsureSalesPlansForPeriodService(
            planRepo,
            templateRepo,
        );
        const service = new GetShopSalesPerformanceService(
            ensureSalesPlans,
            factSource,
        );
        return { service, planRepo, store, aggregate };
    };

    // ⚠️ Ключевой тест Фазы 11 (issue #54/#56): margin ERP-факта не равен
    // turnover - cost, и SalesPerformance отражает именно это значение
    // (MoySkladDemandPosition.profit), а не пересчитанное.
    it('margin в SalesPerformance равен переданному ERP-агрегату, а не turnover - cost', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service } = buildService(
                [plan],
                [
                    {
                        department: 1,
                        category: null,
                        turnover: 400_000,
                        cost: 240_000,
                        margin: 130_000, // != turnover - cost (160_000)
                        quantity: 10,
                    },
                ],
            );

            const performances = await service.listForPeriod('2026-08');

            expect(performances).toHaveLength(1);
            expect(performances[0].getFact().getMargin()).toBe(130_000);
            expect(performances[0].getFact().getMargin()).not.toBe(
                performances[0].getFact().getTurnover() -
                    performances[0].getFact().getCost(),
            );
        });
    });

    it('изменение плана меняет percentCompletion при неизменном факте ERP', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const facts = [
                {
                    department: 1,
                    category: null,
                    turnover: 500_000,
                    cost: 300_000,
                    margin: 200_000,
                    quantity: 10,
                },
            ];
            const { service } = buildService([plan], facts);

            const before = await service.listForPeriod('2026-08');
            expect(before[0].getFact().getPercentCompletion()).toBe(50);

            plan.edit({ turnover: 2_000_000 });

            const after = await service.listForPeriod('2026-08');
            expect(after[0].getFact().getPercentCompletion()).toBe(25);
        });
    });

    it('удаление плана удаляет факт и прогноз — строка пропадает из ShopSalesPerformance', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service, planRepo } = buildService([plan], []);

            const before = await service.listForPeriod('2026-08');
            expect(before).toHaveLength(1);

            await planRepo.delete(plan.id);

            const after = await service.listForPeriod('2026-08');
            expect(after).toHaveLength(0);
        });
    });

    it('план без ERP-факта за период получает нулевой факт, а не ошибку', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service } = buildService([plan], []);

            const performances = await service.listForPeriod('2026-08');

            expect(performances[0].getFact().getTurnover()).toBe(0);
            expect(performances[0].getFact().getMargin()).toBe(0);
            expect(performances[0].getFact().getPercentCompletion()).toBe(0);
        });
    });

    // Фаза 1 (docs/shop-sales-performance-by-category): listForPeriod
    // собирает уникальные непустые plan.category и передаёт их вторым
    // аргументом в factSource.aggregate(period, categoryIds) — сам
    // репозиторий раскрывает категорию до потомков (см.
    // moysklad-sales-fact-source.repository.spec.ts), здесь важно только,
    // что план с category теперь получает непустой факт по совпадающей
    // категории ERP-агрегата и не смешивается с планом без категории.
    it('план с category получает факт из ERP-агрегата с этой же category, передаёт categoryIds в aggregate', async () => {
        await withRequestContext(async () => {
            const planWithCategory = SalesPlan.create({
                direction: 'shop',
                department: 1,
                category: 'folder-phones',
                period: '2026-08',
                turnover: 500_000,
                margin: 100_000,
                source: 'MANUAL',
            });
            const planWithoutCategory = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const facts = [
                {
                    department: 1,
                    category: 'folder-phones',
                    turnover: 300_000,
                    cost: 180_000,
                    margin: 90_000,
                    quantity: 5,
                },
                {
                    department: 1,
                    category: null,
                    turnover: 400_000,
                    cost: 240_000,
                    margin: 130_000,
                    quantity: 10,
                },
            ];
            const { service, aggregate } = buildService(
                [planWithCategory, planWithoutCategory],
                facts,
            );

            const performances = await service.listForPeriod('2026-08');

            expect(aggregate).toHaveBeenCalledWith('2026-08', [
                'folder-phones',
            ]);

            const withCategory = performances.find(
                (p) => p.getCategory() === 'folder-phones',
            );
            const withoutCategory = performances.find(
                (p) => p.getCategory() === null,
            );

            expect(withCategory?.getFact().getTurnover()).toBe(300_000);
            expect(withCategory?.getFact().getMargin()).toBe(90_000);
            expect(withoutCategory?.getFact().getTurnover()).toBe(400_000);
            expect(withoutCategory?.getFact().getMargin()).toBe(130_000);
        });
    });

    it('findForScope находит строку по отделу и категории', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service } = buildService([plan], []);

            const found = await service.findForScope('2026-08', 1, null);
            const notFound = await service.findForScope('2026-08', 2, null);

            expect(found?.getPlan().id).toBe(plan.id);
            expect(notFound).toBeNull();
        });
    });
});
