import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateSalesPlanHandler } from './create-sales-plan.handler';
import { CreateSalesPlanCommand } from './create-sales-plan.command';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
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
        // run() выполняет переданную работу напрямую, без реальной
        // транзакции — для юнит-теста хендлера этого достаточно,
        // транзакционность самого UnitOfWork проверяется отдельно на
        // уровне его реализации (см. тот же приём в
        // create-motivation-schema.handler.spec.ts соседнего модуля
        // accounting).
        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };
        const handler = new CreateSalesPlanHandler(repo, unitOfWork);
        return { handler, insert, findByScope, run };
    };

    const baseItem = {
        department: 1,
        period: '2026-08',
        turnover: 1_000_000,
        margin: 200_000,
    };

    it('создаёт план с source = MANUAL и сохраняет через репозиторий', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: [baseItem],
            });

            const result = await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                direction: 'service',
                department: 1,
                category: null,
                period: '2026-08',
                source: 'MANUAL',
                status: 'CREATED',
            });
        });
    });

    it('оборачивает запись в unitOfWork.run', async () => {
        await withRequestContext(async () => {
            const { handler, run } = buildHandler();
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: [baseItem],
            });

            await handler.execute(command);

            expect(run).toHaveBeenCalledTimes(1);
        });
    });

    it('отклоняет дубль по (direction, department, category, period)', async () => {
        await withRequestContext(async () => {
            const existing = SalesPlan.create({
                ...baseItem,
                direction: 'service',
                source: 'MANUAL',
            });
            const { handler, insert } = buildHandler(existing);
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: [baseItem],
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                SalesPlanAlreadyExistsException,
            );
            expect(insert).not.toHaveBeenCalled();
        });
    });

    it('batch: создаёт несколько планов разных отделов/категорий одного направления за один вызов', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: [
                    { ...baseItem, category: 10 },
                    { ...baseItem, department: 2 },
                ],
            });

            const result = await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(2);
            expect(result).toMatchObject([
                { direction: 'service', department: 1, category: 10 },
                { direction: 'service', department: 2, category: null },
            ]);
        });
    });

    it('batch: отклоняет дубль внутри самого запроса, не вызывая insert ни разу', async () => {
        await withRequestContext(async () => {
            const { handler, insert, findByScope } = buildHandler();
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: [baseItem, { ...baseItem }],
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                SalesPlanAlreadyExistsException,
            );
            expect(findByScope).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
        });
    });

    it('batch: конфликт с уже существующей строкой в БД останавливает обработку остальных элементов', async () => {
        await withRequestContext(async () => {
            const existing = SalesPlan.create({
                ...baseItem,
                direction: 'service',
                source: 'MANUAL',
            });
            const { handler, insert } = buildHandler(existing);
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: [baseItem, { ...baseItem, department: 2 }],
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                SalesPlanAlreadyExistsException,
            );
            expect(insert).not.toHaveBeenCalled();
        });
    });
});
