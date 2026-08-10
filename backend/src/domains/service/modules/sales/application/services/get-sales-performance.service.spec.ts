import { withRequestContext } from '@/shared/testing/with-request-context';
import { GetSalesPerformanceService } from './get-sales-performance.service';
import { EnsureSalesPlansForPeriodService } from './ensure-sales-plans-for-period.service';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import type { ServiceSalesFactSourcePort } from '../ports/service-sales-fact-source.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPerformanceDirectionNotSupportedException } from '../../domain/exceptions/sales-performance.exception';

// Имитирует БД в памяти для плана (как в ensure-sales-plans-for-period.service.spec.ts)
// и подставляет фейковый источник ERP-факта — сам сценарий проверяет сборку
// SalesPerformance, а не устройство репозиториев.
describe('GetSalesPerformanceService', () => {
    const buildService = (
        plans: SalesPlan[],
        facts: {
            department: number;
            category: number | null;
            turnover: number;
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
        const factSource: ServiceSalesFactSourcePort = {
            aggregate: jest.fn().mockResolvedValue(facts),
        };
        const ensureSalesPlans = new EnsureSalesPlansForPeriodService(
            planRepo,
            templateRepo,
        );
        const service = new GetSalesPerformanceService(
            ensureSalesPlans,
            factSource,
        );
        return { service, planRepo, store };
    };

    it('план в статусе CREATED полноценно участвует в расчёте процента выполнения', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            expect(plan.status).toBe('CREATED');
            const { service } = buildService(
                [plan],
                [
                    {
                        department: 1,
                        category: null,
                        turnover: 400_000,
                        cost: 240_000,
                        quantity: 10,
                    },
                ],
            );

            const performances = await service.listForPeriod(
                'service',
                '2026-08',
            );

            expect(performances).toHaveLength(1);
            const performance = performances[0];
            expect(performance.getPlan().status).toBe('CREATED');
            expect(performance.getFact().getPercentCompletion()).toBe(40);
        });
    });

    it('изменение плана меняет percentCompletion при неизменном факте ERP', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
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
                    quantity: 10,
                },
            ];
            const { service } = buildService([plan], facts);

            const before = await service.listForPeriod('service', '2026-08');
            expect(before[0].getFact().getPercentCompletion()).toBe(50);

            plan.edit({ turnover: 2_000_000 });

            const after = await service.listForPeriod('service', '2026-08');
            expect(after[0].getFact().getPercentCompletion()).toBe(25);
        });
    });

    it('удаление плана удаляет факт и прогноз — строка пропадает из SalesPerformance', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service, planRepo } = buildService([plan], []);

            const before = await service.listForPeriod('service', '2026-08');
            expect(before).toHaveLength(1);

            await planRepo.delete(plan.id);

            const after = await service.listForPeriod('service', '2026-08');
            expect(after).toHaveLength(0);
        });
    });

    it('строка ERP-факта без соответствующего плана в результат не попадает (нет строки для сравнения)', async () => {
        await withRequestContext(async () => {
            const { service } = buildService(
                [],
                [
                    {
                        department: 99,
                        category: null,
                        turnover: 100,
                        cost: 50,
                        quantity: 1,
                    },
                ],
            );

            const performances = await service.listForPeriod(
                'service',
                '2026-08',
            );

            expect(performances).toHaveLength(0);
        });
    });

    it('план без ERP-факта за период получает нулевой факт, а не ошибку', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service } = buildService([plan], []);

            const performances = await service.listForPeriod(
                'service',
                '2026-08',
            );

            expect(performances[0].getFact().getTurnover()).toBe(0);
            expect(performances[0].getFact().getPercentCompletion()).toBe(0);
        });
    });

    it('findForScope находит строку по отделу и категории', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });
            const { service } = buildService([plan], []);

            const found = await service.findForScope(
                'service',
                '2026-08',
                1,
                null,
            );
            const notFound = await service.findForScope(
                'service',
                '2026-08',
                2,
                null,
            );

            expect(found?.getPlan().id).toBe(plan.id);
            expect(notFound).toBeNull();
        });
    });

    it('отклоняет направление shop — в Фазе 5 реализован только service', async () => {
        await withRequestContext(async () => {
            const { service } = buildService([], []);

            await expect(
                service.listForPeriod('shop', '2026-08'),
            ).rejects.toThrow(SalesPerformanceDirectionNotSupportedException);
        });
    });
});
