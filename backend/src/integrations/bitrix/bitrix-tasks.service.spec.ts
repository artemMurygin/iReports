import { BadGatewayException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { BitrixTasksService } from './bitrix-tasks.service';
import type { BitrixHttpService } from './bitrix.instance';

jest.mock('@/shared/delay', () => ({
    delay: jest.fn().mockResolvedValue(undefined),
}));

type BatchRequestBody = { halt: number; cmd: Record<string, string> };

const buildHttp = () => {
    const post = jest.fn<Promise<{ data: unknown }>, [string, unknown?]>();
    const http = {
        instance: { post },
        BITRIX_DELAY_MS: 0,
    } as unknown as BitrixHttpService;
    return { http, post };
};

describe('BitrixTasksService', () => {
    describe('createTask', () => {
        it('создаёт задачу с ответственным, тегами и дедлайном, возвращает её ID', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce({
                data: { result: { task: { id: '3711' } } },
            });
            const service = new BitrixTasksService(http);

            const id = await service.createTask({
                title: 'За задачу',
                description: 'Описание',
                responsibleId: 42,
                deadline: new Date('2026-08-20T00:00:00.000Z'),
                period: '2026-08',
            });

            expect(id).toBe(3711);
            expect(post).toHaveBeenCalledTimes(1);
            const [url, body] = post.mock.calls[0];
            expect(url).toBe('/tasks.task.add');
            expect(body).toMatchObject({
                fields: {
                    TITLE: 'За задачу',
                    DESCRIPTION: 'Описание',
                    RESPONSIBLE_ID: 42,
                    DEADLINE: '2026-08-20T00:00:00.000Z',
                    TAGS: ['Зарплатная задача', 'период:2026-08'],
                },
            });
        });

        it('после исчерпания ретраев выбрасывает BadGatewayException', async () => {
            const { http, post } = buildHttp();
            post.mockRejectedValue(new Error('network down'));
            const service = new BitrixTasksService(http);

            await expect(
                service.createTask({
                    title: 'X',
                    responsibleId: 1,
                    deadline: new Date('2026-08-20T00:00:00.000Z'),
                    period: '2026-08',
                }),
            ).rejects.toThrow(BadGatewayException);
            expect(post).toHaveBeenCalledTimes(4);
        });
    });

    describe('deleteTask', () => {
        it('успешно удаляет задачу', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce({ data: { result: true } });
            const service = new BitrixTasksService(http);

            await expect(service.deleteTask(3711)).resolves.toBeUndefined();
            expect(post).toHaveBeenCalledWith('/tasks.task.delete', {
                id: 3711,
            });
        });

        it('404 (задача уже удалена) не считается ошибкой', async () => {
            const { http, post } = buildHttp();
            const notFound = new AxiosError('Not Found');
            notFound.response = {
                status: 404,
                data: {},
                statusText: 'Not Found',
                headers: {},
                // @ts-expect-error – не важна для теста
                config: {},
            };
            post.mockRejectedValueOnce(notFound);
            const service = new BitrixTasksService(http);

            await expect(service.deleteTask(3711)).resolves.toBeUndefined();
            expect(post).toHaveBeenCalledTimes(1);
        });

        it('прочая ошибка сети всё же ретраится и в итоге падает', async () => {
            const { http, post } = buildHttp();
            post.mockRejectedValue(new Error('timeout'));
            const service = new BitrixTasksService(http);

            await expect(service.deleteTask(3711)).rejects.toThrow(
                BadGatewayException,
            );
            expect(post).toHaveBeenCalledTimes(4);
        });
    });

    describe('getTasksBatch', () => {
        const buildBatchResponse = (
            items: Record<
                string,
                | { task: Record<string, unknown> }
                | { error: string }
                | undefined
            >,
        ) => {
            const result: Record<string, unknown> = {};
            const result_error: Record<string, { error: string }> = {};
            for (const [key, value] of Object.entries(items)) {
                if (!value) continue;
                if ('error' in value) {
                    result_error[key] = { error: value.error };
                } else {
                    result[key] = value;
                }
            }
            return { data: { result: { result, result_error } } };
        };

        it('парсит валидный тег периода, статус и ответственного', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce(
                buildBatchResponse({
                    task_0: {
                        task: {
                            id: '1',
                            title: 'Задача',
                            status: '3',
                            responsibleId: '42',
                            deadline: null,
                            // tasks.task.get отдаёт tags объектом, ключ —
                            // ID тега (проверено вручную на реальном
                            // webhook'е), а не списком строк.
                            tags: {
                                '12': { id: 12, title: 'Зарплатная задача' },
                                '16': { id: 16, title: 'период:2026-08' },
                            },
                        },
                    },
                }),
            );
            const service = new BitrixTasksService(http);

            const [item] = await service.getTasksBatch([1]);

            expect(item).toEqual({
                id: 1,
                isAvailable: true,
                status: '3',
                responsibleId: 42,
                period: '2026-08',
            });
        });

        it('отсутствующий тег периода даёт period: null', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce(
                buildBatchResponse({
                    task_0: {
                        task: {
                            id: '1',
                            title: 'Задача',
                            status: '2',
                            responsibleId: '42',
                            deadline: null,
                            tags: {
                                '12': { id: 12, title: 'Зарплатная задача' },
                            },
                        },
                    },
                }),
            );
            const service = new BitrixTasksService(http);

            const [item] = await service.getTasksBatch([1]);

            expect(item.period).toBeNull();
            expect(item.isAvailable).toBe(true);
        });

        it('повреждённый формат тега периода даёт period: null', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce(
                buildBatchResponse({
                    task_0: {
                        task: {
                            id: '1',
                            title: 'Задача',
                            status: '2',
                            responsibleId: '42',
                            deadline: null,
                            tags: {
                                '16': { id: 16, title: 'период:not-a-month' },
                            },
                        },
                    },
                }),
            );
            const service = new BitrixTasksService(http);

            const [item] = await service.getTasksBatch([1]);

            expect(item.period).toBeNull();
        });

        it('пустой набор тегов в форме [] (эмпти PHP-массив) не падает, даёт period: null', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce(
                buildBatchResponse({
                    task_0: {
                        task: {
                            id: '1',
                            title: 'Задача',
                            status: '2',
                            responsibleId: '42',
                            deadline: null,
                            tags: [],
                        },
                    },
                }),
            );
            const service = new BitrixTasksService(http);

            const [item] = await service.getTasksBatch([1]);

            expect(item.period).toBeNull();
            expect(item.isAvailable).toBe(true);
        });

        it('задача с ошибкой в batch-ответе (удалена/недоступна) помечается isAvailable: false', async () => {
            const { http, post } = buildHttp();
            post.mockResolvedValueOnce(
                buildBatchResponse({
                    task_0: { error: 'TASK_NOT_FOUND' },
                }),
            );
            const service = new BitrixTasksService(http);

            const [item] = await service.getTasksBatch([1]);

            expect(item).toEqual({
                id: 1,
                isAvailable: false,
                status: null,
                responsibleId: null,
                period: null,
            });
        });

        it('пустой список ID не делает HTTP-запрос', async () => {
            const { http, post } = buildHttp();
            const service = new BitrixTasksService(http);

            const result = await service.getTasksBatch([]);

            expect(result).toEqual([]);
            expect(post).not.toHaveBeenCalled();
        });

        it('более 50 ID разбивается на несколько batch-запросов', async () => {
            const { http, post } = buildHttp();
            const ids = Array.from({ length: 75 }, (_, i) => i + 1);

            post.mockImplementation((_url, body) => {
                const { cmd } = body as BatchRequestBody;
                const items: Record<string, { task: Record<string, unknown> }> =
                    {};
                Object.keys(cmd).forEach((key, i) => {
                    items[key] = {
                        task: {
                            id: String(i),
                            title: 'T',
                            status: '2',
                            responsibleId: '1',
                            deadline: null,
                            tags: [],
                        },
                    };
                });
                return Promise.resolve(buildBatchResponse(items));
            });

            const service = new BitrixTasksService(http);
            const result = await service.getTasksBatch(ids);

            expect(post).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(75);
            const firstBody = post.mock.calls[0][1] as BatchRequestBody;
            const secondBody = post.mock.calls[1][1] as BatchRequestBody;
            expect(Object.keys(firstBody.cmd)).toHaveLength(50);
            expect(Object.keys(secondBody.cmd)).toHaveLength(25);
        });
    });
});
