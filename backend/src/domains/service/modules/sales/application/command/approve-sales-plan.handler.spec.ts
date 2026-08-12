import { withRequestContext } from '@/shared/testing/with-request-context';
import { ApproveSalesPlanHandler } from './approve-sales-plan.handler';
import { ApproveSalesPlanCommand } from './approve-sales-plan.command';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanNotFoundException } from '../../domain/exceptions/sales-plan.exception';

describe('ApproveSalesPlanHandler', () => {
    const buildPlan = (
        department: number,
        status: 'CREATED' | 'APPROVED' = 'CREATED',
        direction: 'service' | 'shop' = 'service',
    ) => {
        const plan = SalesPlan.create({
            direction,
            department,
            period: '2026-08',
            turnover: 1_000_000,
            margin: 200_000,
            source: 'PREVIOUS_MONTH',
        });
        if (status === 'APPROVED') {
            plan.approve(1);
        }
        return plan;
    };

    const buildHandler = (plans: SalesPlan[]) => {
        const update = jest.fn().mockResolvedValue(undefined);
        const findByIds = jest
            .fn()
            .mockImplementation((ids: string[]) =>
                Promise.resolve(plans.filter((p) => ids.includes(p.id))),
            );
        const findByDirectionAndPeriod = jest.fn().mockResolvedValue(plans);
        const repo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update,
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds,
            findByScope: jest.fn(),
            findByDirectionAndPeriod,
        };
        const handler = new ApproveSalesPlanHandler(repo);
        return { handler, update, findByIds, findByDirectionAndPeriod };
    };

    // Тестовое требование Фазы 3: "массовое утверждение переводит все
    // строки месяца".
    it('утверждает весь месяц по направлению: все строки становятся APPROVED', async () => {
        await withRequestContext(async () => {
            const plans = [
                buildPlan(1, 'CREATED'),
                buildPlan(2, 'CREATED'),
                buildPlan(3, 'APPROVED'),
            ];
            const { handler, update } = buildHandler(plans);

            const result = await handler.execute(
                new ApproveSalesPlanCommand({
                    direction: 'service',
                    period: '2026-08',
                    approvedBy: 99,
                }),
            );

            expect(result).toHaveLength(3);
            expect(result.every((p) => p.status === 'APPROVED')).toBe(true);
            // Только две реально изменённые строки уходят на update() — уже
            // утверждённая ранее не трогается.
            expect(update).toHaveBeenCalledTimes(2);
        });
    });

    it('утверждает построчно по списку ids', async () => {
        await withRequestContext(async () => {
            const plans = [buildPlan(1), buildPlan(2)];
            const { handler, update } = buildHandler(plans);

            const result = await handler.execute(
                new ApproveSalesPlanCommand({
                    direction: 'service',
                    ids: [plans[0].id],
                    approvedBy: 7,
                }),
            );

            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('APPROVED');
            expect(result[0].approvedBy).toBe(7);
            expect(update).toHaveBeenCalledTimes(1);
        });
    });

    it('падает NotFound, если один из переданных ids не найден', async () => {
        await withRequestContext(async () => {
            const plans = [buildPlan(1)];
            const { handler } = buildHandler(plans);

            await expect(
                handler.execute(
                    new ApproveSalesPlanCommand({
                        direction: 'service',
                        ids: [plans[0].id, 'missing'],
                        approvedBy: 7,
                    }),
                ),
            ).rejects.toBeInstanceOf(SalesPlanNotFoundException);
        });
    });

    // Хотя бы один id из чужого направления — весь approve отклоняется, как
    // будто этот id не найден вовсе, и ни одна строка (в т.ч. "своя") не
    // утверждается.
    it('падает NotFound и не утверждает ничего, если один из ids принадлежит другому направлению', async () => {
        await withRequestContext(async () => {
            const ownPlan = buildPlan(1, 'CREATED', 'service');
            const foreignPlan = buildPlan(2, 'CREATED', 'shop');
            const { handler, update } = buildHandler([ownPlan, foreignPlan]);

            await expect(
                handler.execute(
                    new ApproveSalesPlanCommand({
                        direction: 'service',
                        ids: [ownPlan.id, foreignPlan.id],
                        approvedBy: 7,
                    }),
                ),
            ).rejects.toBeInstanceOf(SalesPlanNotFoundException);
            expect(update).not.toHaveBeenCalled();
        });
    });
});
