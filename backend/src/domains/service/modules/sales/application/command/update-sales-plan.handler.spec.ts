import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateSalesPlanHandler } from './update-sales-plan.handler';
import { UpdateSalesPlanCommand } from './update-sales-plan.command';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanNotFoundException } from '../../domain/exceptions/sales-plan.exception';

describe('UpdateSalesPlanHandler', () => {
    const buildHandler = (found: SalesPlan | null) => {
        const update = jest.fn().mockResolvedValue(undefined);
        const findById = jest.fn().mockResolvedValue(found);
        const repo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update,
            delete: jest.fn(),
            findById,
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest.fn(),
        };
        const handler = new UpdateSalesPlanHandler(repo);
        return { handler, update };
    };

    it('падает NotFound, если плана не существует', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(null);
            const command = new UpdateSalesPlanCommand({
                planId: 'missing',
                direction: 'service',
                turnover: 100,
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                SalesPlanNotFoundException,
            );
        });
    });

    it('падает NotFound, если план найден, но принадлежит другому направлению', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            });

            const { handler, update } = buildHandler(plan);
            const command = new UpdateSalesPlanCommand({
                planId: plan.id,
                direction: 'service',
                turnover: 1_200_000,
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                SalesPlanNotFoundException,
            );
            expect(update).not.toHaveBeenCalled();
        });
    });

    // Тестовое требование Фазы 3: "правка утверждённой строки возвращает
    // её в CREATED" — плюс source переходит в MANUAL.
    it('правка утверждённой строки возвращает её в CREATED и MANUAL', async () => {
        await withRequestContext(async () => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'PREVIOUS_MONTH',
            });
            plan.approve(42);
            expect(plan.status).toBe('APPROVED');

            const { handler, update } = buildHandler(plan);
            const command = new UpdateSalesPlanCommand({
                planId: plan.id,
                direction: 'service',
                turnover: 1_200_000,
            });

            const result = await handler.execute(command);

            expect(result.status).toBe('CREATED');
            expect(result.source).toBe('MANUAL');
            expect(result.turnover).toBe(1_200_000);
            expect(result.approvedBy).toBeNull();
            expect(update).toHaveBeenCalledTimes(1);
        });
    });
});
