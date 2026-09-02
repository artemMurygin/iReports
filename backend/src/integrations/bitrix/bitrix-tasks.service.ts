import { BadGatewayException, Injectable } from '@nestjs/common';
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { BitrixHttpService } from './bitrix.instance';
import { delay } from '@/shared/delay';
import {
    BITRIX_SALARY_TASK_TAG,
    buildBitrixTaskPeriodTag,
    parseBitrixTaskPeriodTag,
} from './bitrix.config';
import type {
    BitrixBatchResponse,
    BitrixTaskGetBatchResult,
    BitrixTaskStatus,
} from './bitrix-api.types';

// Значения select[] у tasks.task.get — это классические (UPPER_SNAKE_CASE)
// имена полей Bitrix24 Tasks, а НЕ camelCase-имена, в которых сам метод
// отдаёт ответ (id/title/status/responsibleId/tags — см. BitrixTask). Любое
// нераспознанное значение (в т.ч. просто неверный регистр camelCase-имени)
// молча ломает весь select — API в этом случае возвращает не запрошенные
// поля, а произвольный минимальный набор (id/favorite/group/action),
// проверено вручную через tasks.task.get с реальным webhook'ом. TAGS,
// в частности, не входит в дефолтный набор полей ответа вообще — без
// явного select[]=TAGS его нет в ответе, даже если запросить task целиком
// без select.
const TASK_GET_SELECT = [
    'ID',
    'TITLE',
    'STATUS',
    'RESPONSIBLE_ID',
    'DEADLINE',
    'TAGS',
];

const BITRIX_BATCH_CHUNK_SIZE = 50;

export interface CreateBitrixTaskParams {
    title: string;
    description?: string;
    responsibleId: number;
    deadline: Date;
    /** Расчётный месяц (YYYY-MM), кодируется тегом периода (bitrix.config.ts). */
    period: string;
}

/** Результат getTasksBatch по одной задаче — недоступная/удалённая задача помечается isAvailable: false, без начисления (spec.md, "Обработка недоступной задачи"). */
export interface BitrixTaskBatchItem {
    id: number;
    isAvailable: boolean;
    status: BitrixTaskStatus | null;
    responsibleId: number | null;
    /** Расчётный месяц, распарсенный из тега периода; null, если тег отсутствует/не распознан. */
    period: string | null;
}

/**
 * Write-доступ к задачам Bitrix24 (tasks.task.*) — отдельный от
 * read-only BitrixService, который обслуживает синк сделок/справочников
 * (design.md change salary-rule-bitrix-task, Decision 3). Использует тот
 * же webhook-клиент (BitrixHttpService) и тот же паттерн ретраев с
 * экспоненциальным бэкоффом, что и BitrixService._getWithRetry.
 */
@Injectable()
export class BitrixTasksService {
    constructor(private bitrix: BitrixHttpService) {}

    /** Создаёт задачу типа "Зарплатная задача"; статус явно не выставляется — Bitrix24 создаёт со штатным "Ждёт выполнения". */
    async createTask(params: CreateBitrixTaskParams): Promise<number> {
        const { data } = await this._postWithRetry<{
            result: { task: { id: string } };
        }>('/tasks.task.add', {
            fields: {
                TITLE: params.title,
                DESCRIPTION: params.description ?? '',
                RESPONSIBLE_ID: params.responsibleId,
                DEADLINE: params.deadline.toISOString(),
                TAGS: [
                    BITRIX_SALARY_TASK_TAG,
                    buildBitrixTaskPeriodTag(params.period),
                ],
            },
        });

        return Number(data.result.task.id);
    }

    /** Удаляет задачу. Задача, уже отсутствующая в Bitrix24 (404/NOT_FOUND), не считается ошибкой удаления. */
    async deleteTask(taskId: number): Promise<void> {
        try {
            await this._requestWithRetry(
                () =>
                    this.bitrix.instance.post('/tasks.task.delete', {
                        id: taskId,
                    }),
                { isTerminal: (err) => this._isTaskAlreadyGoneError(err) },
            );
        } catch (err) {
            if (this._isTaskAlreadyGoneError(err)) return;
            throw err;
        }
    }

    /** Пакетно получает статус/ответственного/расчётный месяц по списку ID через нативный batch (до 50 под-команд за HTTP-запрос, чанкуется при большем числе). */
    async getTasksBatch(taskIds: number[]): Promise<BitrixTaskBatchItem[]> {
        const results: BitrixTaskBatchItem[] = [];

        for (const chunk of this._chunk(taskIds, BITRIX_BATCH_CHUNK_SIZE)) {
            const cmd: Record<string, string> = {};
            chunk.forEach((id, index) => {
                cmd[this._batchKey(index)] = this._buildTaskGetCommand(id);
            });

            const { data } = await this._postWithRetry<
                BitrixBatchResponse<BitrixTaskGetBatchResult>
            >('/batch', { halt: 0, cmd });

            chunk.forEach((id, index) => {
                results.push(
                    this._toBatchItem(id, data, this._batchKey(index)),
                );
            });

            if (chunk.length === BITRIX_BATCH_CHUNK_SIZE) {
                await delay(this.bitrix.BITRIX_DELAY_MS);
            }
        }

        return results;
    }

    private _batchKey(index: number): string {
        return `task_${index}`;
    }

    private _buildTaskGetCommand(id: number): string {
        const params = new URLSearchParams();
        params.append('id', String(id));
        TASK_GET_SELECT.forEach((field) => params.append('select[]', field));
        return `tasks.task.get?${params.toString()}`;
    }

    private _toBatchItem(
        id: number,
        data: BitrixBatchResponse<BitrixTaskGetBatchResult>,
        key: string,
    ): BitrixTaskBatchItem {
        const unavailable: BitrixTaskBatchItem = {
            id,
            isAvailable: false,
            status: null,
            responsibleId: null,
            period: null,
        };

        if (data.result.result_error?.[key]) return unavailable;

        const task = data.result.result?.[key]?.task;
        if (!task) return unavailable;

        return {
            id,
            isAvailable: true,
            status: task.status,
            responsibleId: Number(task.responsibleId),
            period: parseBitrixTaskPeriodTag(task.tags),
        };
    }

    private _chunk<T>(items: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
        }
        return chunks;
    }

    private _isTaskAlreadyGoneError(err: unknown): boolean {
        if (!axios.isAxiosError(err)) return false;
        if (err.response?.status === 404) return true;

        const errorCode = (
            err.response?.data as { error?: unknown } | undefined
        )?.error;
        return typeof errorCode === 'string' && /NOT_FOUND/i.test(errorCode);
    }

    private _postWithRetry<T>(
        url: string,
        payload?: unknown,
        config?: AxiosRequestConfig,
    ): Promise<AxiosResponse<T>> {
        return this._requestWithRetry<T>(() =>
            this.bitrix.instance.post<T>(url, payload, config),
        );
    }

    private async _requestWithRetry<T>(
        request: () => Promise<AxiosResponse<T>>,
        options: {
            retries?: number;
            isTerminal?: (err: unknown) => boolean;
        } = {},
    ): Promise<AxiosResponse<T>> {
        const { retries = 4, isTerminal } = options;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await request();
            } catch (err) {
                if (isTerminal?.(err)) throw err;
                if (attempt === retries - 1) {
                    throw new BadGatewayException(
                        `Failed to reach Bitrix24: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
                await delay(2_000 * (attempt + 1));
            }
        }
        throw new BadGatewayException(
            'Failed to reach Bitrix24: retries exhausted',
        );
    }
}
