import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateSalesPlanHandler } from './create-sales-plan.handler';
import { CreateSalesPlanCommand } from './create-sales-plan.command';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import { SalesPlanAlreadyExistsException } from '../../domain/exceptions/sales-plan.exception';

describe('CreateSalesPlanHandler', () => {
    const buildHandler = (existing: SalesPlan | null = null) => {
        const insert = jest.fn().mockResolvedValue(undefined);
        const findByScope = jest.fn().mockResolvedValue(existing);
        const repo: SalesPlanRepositoryPort = {
            insert,
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope,
            findByDirectionAndPeriod: jest.fn(),
        };
        const handler = new CreateSalesPlanHandler(repo);
        return { handler, insert, findByScope };
    };

    const baseCommand = {
        direction: 'service' as const,
        department: 1,
        period: '2026-08',
        turnover: 1_000_000,
        margin: 200_000,
    };

    it('создаёт план с source = MANUAL и сохраняет через репозиторий', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateSalesPlanCommand(baseCommand);

            const result = await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({
                direction: 'service',
                department: 1,
                category: null,
                period: '2026-08',
                source: 'MANUAL',
                status: 'CREATED',
            });
        });
    });

    it('отклоняет дубль по (direction, department, category, period)', async () => {
        await withRequestContext(async () => {
            const existing = SalesPlan.create({
                ...baseCommand,
                source: 'MANUAL',
            });
            const { handler, insert } = buildHandler(existing);
            const command = new CreateSalesPlanCommand(baseCommand);

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                SalesPlanAlreadyExistsException,
            );
            expect(insert).not.toHaveBeenCalled();
        });
    });
});
