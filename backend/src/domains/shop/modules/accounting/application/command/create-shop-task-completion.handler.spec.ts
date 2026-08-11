import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateShopTaskCompletionHandler } from './create-shop-task-completion.handler';
import { CreateShopTaskCompletionCommand } from './create-shop-task-completion.command';
import type { ShopTaskCompletionRepositoryPort } from '../ports/shop-task-completion.port';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/shop-task-completion.entity';

describe('CreateShopTaskCompletionHandler', () => {
    const buildHandler = () => {
        const insert = jest
            .fn<Promise<void>, [ShopTaskCompletion]>()
            .mockResolvedValue(undefined);
        const repo: ShopTaskCompletionRepositoryPort = {
            insert,
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByPeriod: jest.fn(),
            findConfirmedByPeriod: jest.fn(),
        };
        const handler = new CreateShopTaskCompletionHandler(repo);
        return { handler, insert };
    };

    it('создаёт ShopTaskCompletion и сохраняет его через репозиторий', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateShopTaskCompletionCommand({
                employeeId: 1,
                period: '2026-08',
                description: 'Выложить товар на витрину',
                createdBy: 2,
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [entity] = insert.mock.calls[0];
            expect(entity).toBeInstanceOf(ShopTaskCompletion);
            expect(entity.employeeId).toBe(1);
            expect(entity.status).toBe('PENDING_CONFIRMATION');
        });
    });

    it('возвращает ответ с полями созданной записи', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateShopTaskCompletionCommand({
                employeeId: 1,
                period: '2026-08',
                description: 'Выложить товар на витрину',
                createdBy: 2,
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
            expect(result.employeeId).toBe(1);
            expect(result.period).toBe('2026-08');
            expect(result.description).toBe('Выложить товар на витрину');
            expect(result.status).toBe('PENDING_CONFIRMATION');
            expect(result.createdBy).toBe(2);
            expect(result.confirmedBy).toBeNull();
            expect(result.confirmedAt).toBeNull();
        });
    });
});
