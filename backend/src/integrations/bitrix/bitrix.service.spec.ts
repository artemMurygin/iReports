import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import type { BitrixHttpService } from './bitrix.instance';

/**
 * Раздел 5 tasks.md (add-task-based-salary-rule): write-методы BitrixService
 * над `tasks.task.*` (design.md Decision 2). Мокается только транспорт
 * (`BitrixHttpService.instance`), сам `BitrixService` конструируется напрямую
 * — тот же приём, что и для остальных интеграционных сервисов в проекте
 * (см. `CustomApiRoappService`), а не через Nest Testing Module.
 */
describe('BitrixService — задачи (tasks.task.*)', () => {
    let post: jest.Mock;
    let get: jest.Mock;
    let httpService: BitrixHttpService;
    let service: BitrixService;

    beforeEach(() => {
        post = jest.fn();
        get = jest.fn();
        httpService = {
            instance: { post, get },
            BITRIX_DELAY_MS: 500,
        } as unknown as BitrixHttpService;
        service = new BitrixService(httpService);
    });

    describe('createTask', () => {
        const validInput = {
            responsibleBitrixUserId: 42,
            title: 'Сдать отчёт за период',
            description: 'Автосозданная задача правила зарплаты',
            deadline: new Date('2026-09-30T20:59:00.000Z'),
        };

        it('шлёт POST tasks.task.add с провалидированным телом и возвращает bitrixTaskId', async () => {
            post.mockResolvedValueOnce({
                data: { result: { task: { id: '1858' } } },
            });

            await expect(service.createTask(validInput)).resolves.toEqual({
                bitrixTaskId: '1858',
            });

            expect(post).toHaveBeenCalledTimes(1);
            expect(post).toHaveBeenCalledWith('/tasks.task.add', {
                fields: {
                    TITLE: validInput.title,
                    RESPONSIBLE_ID: validInput.responsibleBitrixUserId,
                    DESCRIPTION: validInput.description,
                    DEADLINE: validInput.deadline.toISOString(),
                },
            });
        });

        it('не отправляет запрос и бросает BadRequestException на невалидный вход', async () => {
            await expect(
                service.createTask({
                    ...validInput,
                    title: '',
                }),
            ).rejects.toBeInstanceOf(BadRequestException);

            expect(post).not.toHaveBeenCalled();
        });

        it('бросает BadGatewayException на сетевую/HTTP-ошибку, без ретраев', async () => {
            post.mockRejectedValueOnce(new Error('ECONNRESET'));

            await expect(service.createTask(validInput)).rejects.toBeInstanceOf(
                BadGatewayException,
            );

            // В отличие от read-методов (_getWithRetry, до 4 попыток) —
            // повторное создание задачи может задвоить её в Bitrix24
            // (design.md, раздел 5 tasks.md), поэтому ретраев быть не должно.
            expect(post).toHaveBeenCalledTimes(1);
        });

        it('бросает BadGatewayException на неожиданный формат ответа', async () => {
            post.mockResolvedValueOnce({ data: { result: {} } });

            await expect(service.createTask(validInput)).rejects.toBeInstanceOf(
                BadGatewayException,
            );
        });
    });

    describe('closeTask', () => {
        it('шлёт POST tasks.task.update со статусом "Завершена"', async () => {
            post.mockResolvedValueOnce({ data: { result: true } });

            await expect(service.closeTask('1858')).resolves.toBeUndefined();

            expect(post).toHaveBeenCalledTimes(1);
            expect(post).toHaveBeenCalledWith('/tasks.task.update', {
                taskId: '1858',
                fields: { STATUS: 5 },
            });
        });

        it('бросает BadGatewayException на сетевую ошибку, без ретраев', async () => {
            post.mockRejectedValueOnce(new Error('timeout'));

            await expect(service.closeTask('1858')).rejects.toBeInstanceOf(
                BadGatewayException,
            );
            expect(post).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateTaskDeadline', () => {
        it('шлёт POST tasks.task.update с новым DEADLINE', async () => {
            post.mockResolvedValueOnce({ data: { result: true } });
            const deadline = new Date('2026-10-31T20:59:00.000Z');

            await expect(
                service.updateTaskDeadline('1858', deadline),
            ).resolves.toBeUndefined();

            expect(post).toHaveBeenCalledTimes(1);
            expect(post).toHaveBeenCalledWith('/tasks.task.update', {
                taskId: '1858',
                fields: { DEADLINE: deadline.toISOString() },
            });
        });

        it('бросает BadGatewayException на сетевую ошибку, без ретраев', async () => {
            post.mockRejectedValueOnce(new Error('timeout'));

            await expect(
                service.updateTaskDeadline('1858', new Date()),
            ).rejects.toBeInstanceOf(BadGatewayException);
            expect(post).toHaveBeenCalledTimes(1);
        });
    });

    describe('fetchTaskStatusesBatch', () => {
        it('не делает сетевой вызов на пустом массиве', async () => {
            await expect(service.fetchTaskStatusesBatch([])).resolves.toEqual(
                new Map(),
            );
            expect(post).not.toHaveBeenCalled();
        });

        it('делает ОДИН batch-запрос вместо N вызовов tasks.task.get', async () => {
            post.mockResolvedValueOnce({
                data: {
                    result: {
                        result: {
                            '1858': { task: { status: '5' } },
                            '1859': { task: { status: '2' } },
                        },
                    },
                },
            });

            await expect(
                service.fetchTaskStatusesBatch(['1858', '1859']),
            ).resolves.toEqual(
                new Map([
                    ['1858', '5'],
                    ['1859', '2'],
                ]),
            );

            expect(post).toHaveBeenCalledTimes(1);
            expect(post).toHaveBeenCalledWith('/batch', {
                halt: 0,
                cmd: {
                    '1858': 'tasks.task.get?taskId=1858&select[]=STATUS',
                    '1859': 'tasks.task.get?taskId=1859&select[]=STATUS',
                },
            });
        });

        it('пропускает id, отсутствующие в result (частичный result_error)', async () => {
            post.mockResolvedValueOnce({
                data: {
                    result: {
                        result: {
                            '1858': { task: { status: '5' } },
                        },
                        result_error: {
                            '1859': { error: 'ERROR_TASK_NOT_FOUND' },
                        },
                    },
                },
            });

            await expect(
                service.fetchTaskStatusesBatch(['1858', '1859']),
            ).resolves.toEqual(new Map([['1858', '5']]));
        });

        it('бросает BadGatewayException на сетевую ошибку, без ретраев', async () => {
            post.mockRejectedValueOnce(new Error('timeout'));

            await expect(
                service.fetchTaskStatusesBatch(['1858']),
            ).rejects.toBeInstanceOf(BadGatewayException);
            expect(post).toHaveBeenCalledTimes(1);
        });

        it('одна задача в форме, не совпадающей с {task:{status}} (пустой массив вместо объекта, result_error массивом), не роняет статусы остальных задач батча', async () => {
            post.mockResolvedValueOnce({
                data: {
                    result: {
                        result: {
                            '1858': { task: { status: '5' } },
                            '1859': [],
                            '1860': { task: { status: '2' } },
                        },
                        result_error: [{ error: 'ERROR_TASK_NOT_FOUND' }],
                    },
                },
            });

            await expect(
                service.fetchTaskStatusesBatch(['1858', '1859', '1860']),
            ).resolves.toEqual(
                new Map([
                    ['1858', '5'],
                    ['1860', '2'],
                ]),
            );
        });
    });

    describe('регрессия read-методов', () => {
        it('fetchEmployees по-прежнему использует GET с ретраями (_getWithRetry не тронут)', async () => {
            get.mockResolvedValueOnce({ data: { result: [] } });

            await expect(service.fetchEmployees()).resolves.toEqual([]);
            expect(get).toHaveBeenCalledWith('/user.get', undefined);
        });
    });
});
