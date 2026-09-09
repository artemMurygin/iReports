import { BitrixTasksGatewayAdapter } from './bitrix-tasks-gateway.adapter';
import type { BitrixService } from './bitrix.service';

/**
 * Раздел 6 tasks.md (add-task-based-salary-rule): `BitrixTasksGatewayAdapter`
 * — тонкий адаптер, структурно зеркалирующий `RoappGatewayAdapter`
 * (`domains/service/integrations/roapp-gateway/roapp-gateway.adapter.ts`):
 * делегирует каждый метод порта в соответствующий метод `BitrixService` без
 * собственной бизнес-логики (без ретраев, без валидации, без трансформации
 * аргументов/результата сверх передачи один-в-один).
 */
describe('BitrixTasksGatewayAdapter', () => {
    let createTask: jest.Mock;
    let closeTask: jest.Mock;
    let updateTaskDeadline: jest.Mock;
    let bitrixService: BitrixService;
    let adapter: BitrixTasksGatewayAdapter;

    beforeEach(() => {
        createTask = jest.fn();
        closeTask = jest.fn();
        updateTaskDeadline = jest.fn();
        bitrixService = {
            createTask,
            closeTask,
            updateTaskDeadline,
        } as unknown as BitrixService;
        adapter = new BitrixTasksGatewayAdapter(bitrixService);
    });

    it('createTask делегирует в BitrixService.createTask с теми же аргументами и возвращает тот же результат', async () => {
        const input = {
            responsibleBitrixUserId: 42,
            title: 'Закрыть месяц',
            description: 'Описание задачи',
            deadline: new Date('2026-09-30T00:00:00.000Z'),
        };
        const expected = { bitrixTaskId: '4821' };
        createTask.mockResolvedValue(expected);

        const result = await adapter.createTask(input);

        expect(createTask).toHaveBeenCalledTimes(1);
        expect(createTask).toHaveBeenCalledWith(input);
        expect(result).toBe(expected);
        expect(closeTask).not.toHaveBeenCalled();
        expect(updateTaskDeadline).not.toHaveBeenCalled();
    });

    it('closeTask делегирует в BitrixService.closeTask с тем же bitrixTaskId', async () => {
        closeTask.mockResolvedValue(undefined);

        await adapter.closeTask('4821');

        expect(closeTask).toHaveBeenCalledTimes(1);
        expect(closeTask).toHaveBeenCalledWith('4821');
        expect(createTask).not.toHaveBeenCalled();
        expect(updateTaskDeadline).not.toHaveBeenCalled();
    });

    it('updateDeadline делегирует в BitrixService.updateTaskDeadline с теми же аргументами', async () => {
        updateTaskDeadline.mockResolvedValue(undefined);
        const deadline = new Date('2026-10-31T00:00:00.000Z');

        await adapter.updateDeadline('4821', deadline);

        expect(updateTaskDeadline).toHaveBeenCalledTimes(1);
        expect(updateTaskDeadline).toHaveBeenCalledWith('4821', deadline);
        expect(createTask).not.toHaveBeenCalled();
        expect(closeTask).not.toHaveBeenCalled();
    });

    it('пробрасывает ошибку BitrixService без перехвата/оборачивания (нет собственной бизнес-логики)', async () => {
        const error = new Error('Bitrix24 недоступен');
        createTask.mockRejectedValue(error);

        await expect(
            adapter.createTask({
                responsibleBitrixUserId: 1,
                title: 'x',
                deadline: new Date(),
            }),
        ).rejects.toBe(error);
    });
});
