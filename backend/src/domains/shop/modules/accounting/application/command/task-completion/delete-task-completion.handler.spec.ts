import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteShopTaskCompletionHandler } from './delete-task-completion.handler';
import { DeleteShopTaskCompletionCommand } from './delete-task-completion.command';
import { ShopTaskCompletionNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/task-completion.exception';
import type { ShopTaskCompletionRepositoryPort } from '../../ports/task-completion/task-completion.port';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/task-completion/task-completion.entity';

describe('DeleteShopTaskCompletionHandler', () => {
    const buildHandler = (existing: ShopTaskCompletion | null) => {
        const deleteFn = jest
            .fn<Promise<void>, [string]>()
            .mockResolvedValue(undefined);
        const findById = jest
            .fn<Promise<ShopTaskCompletion | null>, [string]>()
            .mockResolvedValue(existing);
        const repo: ShopTaskCompletionRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: deleteFn,
            findById,
            findByPeriod: jest.fn(),
            findConfirmedByPeriod: jest.fn(),
        };
        const handler = new DeleteShopTaskCompletionHandler(repo);
        return { handler, deleteFn, findById };
    };

    it('удаляет запись через репозиторий', async () => {
        await withRequestContext(async () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 1,
                period: '2026-08',
                description: 'Выложить товар на витрину',
                createdBy: 2,
            });
            const { handler, deleteFn } = buildHandler(completion);
            const command = new DeleteShopTaskCompletionCommand({
                taskCompletionId: completion.id,
            });

            await handler.execute(command);

            expect(deleteFn).toHaveBeenCalledWith(completion.id);
        });
    });

    it('бросает ShopTaskCompletionNotFoundException, если запись не найдена', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(null);
            const command = new DeleteShopTaskCompletionCommand({
                taskCompletionId: 'missing-id',
            });

            await expect(handler.execute(command)).rejects.toThrow(
                ShopTaskCompletionNotFoundException,
            );
        });
    });
});
