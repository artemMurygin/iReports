import { withRequestContext } from '@/shared/testing/with-request-context';
import { ConfirmShopTaskCompletionHandler } from './confirm-task-completion.handler';
import { ConfirmShopTaskCompletionCommand } from './confirm-task-completion.command';
import { ShopTaskCompletionNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/task-completion.exception';
import type { ShopTaskCompletionRepositoryPort } from '../../ports/task-completion/task-completion.port';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/task-completion/task-completion.entity';

describe('ConfirmShopTaskCompletionHandler', () => {
    const buildHandler = (existing: ShopTaskCompletion | null) => {
        const update = jest
            .fn<Promise<void>, [ShopTaskCompletion]>()
            .mockResolvedValue(undefined);
        const findById = jest
            .fn<Promise<ShopTaskCompletion | null>, [string]>()
            .mockResolvedValue(existing);
        const repo: ShopTaskCompletionRepositoryPort = {
            insert: jest.fn(),
            update,
            delete: jest.fn(),
            findById,
            findByPeriod: jest.fn(),
            findConfirmedByPeriod: jest.fn(),
        };
        const handler = new ConfirmShopTaskCompletionHandler(repo);
        return { handler, update, findById };
    };

    it('подтверждает запись и сохраняет её через репозиторий, когда approve=true', async () => {
        await withRequestContext(async () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 1,
                period: '2026-08',
                description: 'Выложить товар на витрину',
                createdBy: 2,
            });
            const { handler, update } = buildHandler(completion);
            const command = new ConfirmShopTaskCompletionCommand({
                taskCompletionId: completion.id,
                confirmedBy: 3,
                approve: true,
            });

            const result = await handler.execute(command);

            expect(result.status).toBe('CONFIRMED');
            expect(result.confirmedBy).toBe(3);
            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toBe(completion);
        });
    });

    it('отклоняет запись, когда approve=false', async () => {
        await withRequestContext(async () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 1,
                period: '2026-08',
                description: 'Выложить товар на витрину',
                createdBy: 2,
            });
            const { handler } = buildHandler(completion);
            const command = new ConfirmShopTaskCompletionCommand({
                taskCompletionId: completion.id,
                confirmedBy: 3,
                approve: false,
            });

            const result = await handler.execute(command);

            expect(result.status).toBe('REJECTED');
        });
    });

    it('бросает ShopTaskCompletionNotFoundException, если запись не найдена', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(null);
            const command = new ConfirmShopTaskCompletionCommand({
                taskCompletionId: 'missing-id',
                confirmedBy: 3,
                approve: true,
            });

            await expect(handler.execute(command)).rejects.toThrow(
                ShopTaskCompletionNotFoundException,
            );
        });
    });
});
