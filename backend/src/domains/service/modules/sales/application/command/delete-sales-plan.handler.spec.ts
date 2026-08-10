import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteSalesPlanHandler } from './delete-sales-plan.handler';
import { DeleteSalesPlanCommand } from './delete-sales-plan.command';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanNotFoundException } from '../../domain/exceptions/sales-plan.exception';

describe('DeleteSalesPlanHandler', () => {
    const buildHandler = (found: SalesPlan | null) => {
        const del = jest.fn().mockResolvedValue(undefined);
        const findById = jest.fn().mockResolvedValue(found);
        const repo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: del,
            findById,
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest.fn(),
        };
        const handler = new DeleteSalesPlanHandler(repo);
        return { handler, del };
    };

    it('падает NotFound, если плана не существует', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(null);
            await expect(
                handler.execute(new DeleteSalesPlanCommand({ planId: 'x' })),
            ).rejects.toBeInstanceOf(SalesPlanNotFoundException);
        });
    });

    it('удаляет существующий план через репозиторий', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 1,
                margin: 1,
                source: 'MANUAL',
            });
            const { handler, del } = buildHandler(plan);

            await handler.execute(
                new DeleteSalesPlanCommand({ planId: plan.id }),
            );

            expect(del).toHaveBeenCalledWith(plan.id);
        });
    });
});
