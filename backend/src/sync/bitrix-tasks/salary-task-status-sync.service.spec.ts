// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории (тот же приём,
// что и в sales-plan-auto-creation.cron.spec.ts).
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { SalaryTaskStatusSyncService } from './salary-task-status-sync.service';
import { logCronError } from '@/shared/cron/cron-file-logger';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { BitrixService } from '@/integrations/bitrix/bitrix.service';

// Раздел 8 tasks.md (add-task-based-salary-rule), design.md Decision 3:
// SalaryTaskStatusSyncService — сквозная (вне domains/{service,shop})
// инфраструктура поллинга статусов Bitrix24 обоих направлений разом; пишет
// напрямую в таблицу salary_tasks через DatabaseService, минуя доменные
// SalaryTaskRepository (не несёт доменной бизнес-логики).
describe('SalaryTaskStatusSyncService', () => {
    const buildService = (options: {
        activeTasks?: { id: string; bitrixTaskId: string }[];
        fetchTaskStatusesBatch?: jest.Mock;
    }) => {
        const findMany = jest
            .fn<
                Promise<{ id: string; bitrixTaskId: string }[]>,
                [{ where?: Record<string, unknown>; select?: unknown }]
            >()
            .mockResolvedValue(options.activeTasks ?? []);
        const update = jest.fn().mockResolvedValue(undefined);
        const db = {
            salaryTask: { findMany, update },
        } as unknown as DatabaseService;
        const bitrix = {
            fetchTaskStatusesBatch:
                options.fetchTaskStatusesBatch ??
                jest.fn().mockResolvedValue(new Map()),
        } as unknown as BitrixService;
        const service = new SalaryTaskStatusSyncService(db, bitrix);
        return { service, findMany, update, bitrix };
    };

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('читает все активные SalaryTask обоих направлений ОДНИМ запросом (без фильтра по direction)', async () => {
        const { service, findMany } = buildService({ activeTasks: [] });

        await service.run();

        expect(findMany).toHaveBeenCalledTimes(1);
        const [call] = findMany.mock.calls[0];
        expect(call.where).not.toHaveProperty('direction');
    });

    it('не делает сетевой вызов, если активных задач нет', async () => {
        const fetchTaskStatusesBatch = jest.fn();
        const { service } = buildService({
            activeTasks: [],
            fetchTaskStatusesBatch,
        });

        await service.run();

        expect(fetchTaskStatusesBatch).not.toHaveBeenCalled();
    });

    it('запрашивает статусы ОДНИМ батч-вызовом для всех найденных задач, не по одной', async () => {
        const fetchTaskStatusesBatch = jest.fn().mockResolvedValue(
            new Map([
                ['1001', '2'],
                ['1002', '5'],
            ]),
        );
        const { service } = buildService({
            activeTasks: [
                { id: 'task-a', bitrixTaskId: '1001' },
                { id: 'task-b', bitrixTaskId: '1002' },
            ],
            fetchTaskStatusesBatch,
        });

        await service.run();

        expect(fetchTaskStatusesBatch).toHaveBeenCalledTimes(1);
        expect(fetchTaskStatusesBatch).toHaveBeenCalledWith(['1001', '1002']);
    });

    it('апсертит taskStatus/lastSyncedAt по каждой найденной записи', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-07T10:00:00.000Z'),
        );
        const fetchTaskStatusesBatch = jest.fn().mockResolvedValue(
            new Map([
                ['1001', '2'],
                ['1002', '5'],
            ]),
        );
        const { service, update } = buildService({
            activeTasks: [
                { id: 'task-a', bitrixTaskId: '1001' },
                { id: 'task-b', bitrixTaskId: '1002' },
            ],
            fetchTaskStatusesBatch,
        });

        await service.run();

        expect(update).toHaveBeenCalledTimes(2);
        expect(update).toHaveBeenCalledWith({
            where: { id: 'task-a' },
            data: {
                taskStatus: '2',
                lastSyncedAt: new Date('2026-09-07T10:00:00.000Z'),
            },
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: 'task-b' },
            data: {
                taskStatus: '5',
                lastSyncedAt: new Date('2026-09-07T10:00:00.000Z'),
            },
        });
    });

    it('пропускает запись, отсутствующую в ответе батча (Bitrix24 не вернул задачу)', async () => {
        const fetchTaskStatusesBatch = jest
            .fn()
            .mockResolvedValue(new Map([['1001', '2']]));
        const { service, update } = buildService({
            activeTasks: [
                { id: 'task-a', bitrixTaskId: '1001' },
                { id: 'task-b', bitrixTaskId: '1002' },
            ],
            fetchTaskStatusesBatch,
        });

        await service.run();

        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'task-a' } }),
        );
    });

    it('при сетевой ошибке батча не роняет весь цикл, логирует и не трогает lastSyncedAt', async () => {
        const fetchTaskStatusesBatch = jest
            .fn()
            .mockRejectedValue(new Error('Bitrix24 timeout'));
        const { service, update } = buildService({
            activeTasks: [{ id: 'task-a', bitrixTaskId: '1001' }],
            fetchTaskStatusesBatch,
        });

        await expect(service.run()).resolves.toBeUndefined();

        expect(update).not.toHaveBeenCalled();
        expect(logCronError).toHaveBeenCalledWith(
            'SalaryTaskStatusSyncService.run',
            expect.any(Error),
            expect.objectContaining({ taskCount: 1 }),
        );
    });
});
