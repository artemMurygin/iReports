import {
    BadGatewayException,
    BadRequestException,
    Injectable,
} from '@nestjs/common';
import { BitrixHttpService } from './bitrix.instance';
import { Filter } from './types';
import {
    BITRIX_TASK_STATUS_COMPLETED,
    BitrixBatchTaskStatusResponseSchema,
    BitrixCreateTaskRequestSchema,
    BitrixDealSchema,
    BitrixTaskAddResponseSchema,
    BitrixTaskStatusEntrySchema,
    BitrixTaskUpdateResponseSchema,
    type BitrixCreateTaskRequest,
} from './schema';
import { delay } from '../../shared/delay';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
    BitrixDepartment,
    BitrixFilteredUserField,
    BitrixListResponse,
    BitrixStatus,
    BitrixUser,
    BitrixUserField,
} from './bitrix-api.types';

interface CreateTaskInput {
    responsibleBitrixUserId: number;
    title: string;
    description?: string;
    deadline: Date;
}

@Injectable()
export class BitrixService {
    private DEAL_FIELDS: string[] = [
        'ID',
        'TITLE',
        'STAGE_ID',
        'CATEGORY_ID',
        'CURRENCY_ID',
        'OPPORTUNITY',
        'ASSIGNED_BY_ID',
        'COMPANY_ID',
        'CONTACT_ID',
        'DATE_CREATE',
        'DATE_MODIFY',
        'SOURCE_ID',
        'UF_CRM_1742462651851',
        'UF_CRM_1730472738',
        'UF_CRM_1703248170106',
        'UF_CRM_1703248232698',
        'UF_CRM_1703248682036',
    ];

    constructor(private bitrix: BitrixHttpService) {}

    async *fetchCreatedDeals(fromDate: undefined | Date = undefined) {
        yield* this._fetchDeals(fromDate, 'CREATE');
    }

    async *fetchModifiedDeals(fromDate: undefined | Date = undefined) {
        yield* this._fetchDeals(fromDate, 'MODIFY');
    }

    private async *_fetchDeals(
        fromDate: undefined | Date = undefined,
        fromField: 'MODIFY' | 'CREATE',
    ) {
        const filter: Filter = { CATEGORY_ID: [0, 16, 10, 2] };
        if (fromDate) {
            const moscowDate = new Date(
                fromDate.getTime() + 3 * 60 * 60 * 1000,
            );
            filter[`>=DATE_${fromField}`] = moscowDate
                .toISOString()
                .slice(0, 19);
        }

        let start = 0;

        while (true) {
            const { data } = await this._getWithRetry<
                BitrixListResponse<unknown[]>
            >('/crm.deal.list', {
                params: { select: this.DEAL_FIELDS, filter, start },
            });

            const deals = data.result.map((deal: unknown) =>
                BitrixDealSchema.parse(deal),
            );

            yield deals;

            if (data.next == null) break;

            start = data.next;
            await delay(this.bitrix.BITRIX_DELAY_MS);
        }
    }

    private async _getWithRetry<T>(
        url: string,
        config?: AxiosRequestConfig,
        retries = 4,
    ): Promise<AxiosResponse<T>> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await this.bitrix.instance.get<T>(url, config);
            } catch (err) {
                if (attempt === retries - 1) {
                    throw new BadGatewayException(
                        `Failed to fetch from Bitrix24: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
                await delay(2_000 * (attempt + 1));
            }
        }
        throw new BadGatewayException(
            'Failed to fetch from Bitrix24: retries exhausted',
        );
    }

    async fetchEmployees(): Promise<BitrixUser[]> {
        return await this._fetchData<BitrixUser>('/user.get');
    }

    // Точечный запрос одного сотрудника по ID (add-bitrix24-auth-and-rbac,
    // BITRIX_EMPLOYEE_UPSERT_PORT) — тот же метод Bitrix24 REST, что и
    // fetchEmployees(), но с фильтром по ID вместо полной выгрузки.
    async fetchEmployeeById(id: number): Promise<BitrixUser | null> {
        const users = await this._fetchData<BitrixUser>('/user.get', {
            params: { ID: id },
        });
        return users[0] ?? null;
    }

    // BitrixSyncService.ensureDepartmentExists — самовосстановление
    // bitrix_departments по одному отделу, тем же приёмом, что и
    // fetchEmployeeById (точечный запрос вместо полной выгрузки).
    async fetchDepartmentById(id: number): Promise<BitrixDepartment | null> {
        const departments = await this._fetchData<BitrixDepartment>(
            '/department.get',
            { params: { ID: id } },
        );
        return departments[0] ?? null;
    }

    async fetchDepartments(): Promise<BitrixDepartment[]> {
        return await this._fetchData<BitrixDepartment>('/department.get');
    }

    async fetchEnums(): Promise<BitrixUserField[]> {
        return await this._fetchData<BitrixUserField>(
            '/crm.deal.userfield.list',
        );
    }

    async fetchLeadSources(): Promise<BitrixFilteredUserField[]> {
        return await this._fetchData<BitrixFilteredUserField>(
            '/crm.deal.userfield.list',
            {
                params: {
                    filter: { FIELD_NAME: 'UF_CRM_1742462651851' },
                },
            },
        );
    }

    async fetchDeviceTypes(): Promise<BitrixFilteredUserField[]> {
        return await this._fetchData<BitrixFilteredUserField>(
            '/crm.deal.userfield.list',
            {
                params: {
                    filter: { FIELD_NAME: 'UF_CRM_1703248170106' },
                },
            },
        );
    }

    async fetchStages(): Promise<BitrixStatus[]> {
        return await this._fetchData<BitrixStatus>('/crm.status.list', {
            params: {
                filter: {},
            },
        });
    }

    async fetchSources(): Promise<BitrixStatus[]> {
        return await this._fetchData<BitrixStatus>('/crm.status.list', {
            params: {
                filter: { ENTITY_ID: 'SOURCE' },
            },
        });
    }

    private async _fetchData<T>(
        url: string,
        params?: AxiosRequestConfig,
    ): Promise<T[]> {
        const { data } = await this._getWithRetry<BitrixListResponse<T[]>>(
            url,
            params,
        );
        return data.result;
    }

    // --- Задачи Bitrix24 (tasks.task.*) ---
    //
    // Раздел 5 tasks.md (add-task-based-salary-rule), design.md Decision 2:
    // write-методы над `tasks.task.*` живут прямо на BitrixService (не в
    // отдельном классе-клиенте), используют тот же BitrixHttpService, что и
    // read-методы выше, но НЕ используют _getWithRetry — повторная отправка
    // мутирующего запроса (создание/закрытие/сдвиг дедлайна задачи) при
    // сетевой ошибке может задвоить эффект в Bitrix24, поэтому ретраев нет:
    // при ошибке метод один раз бросает BadGatewayException и вызывающий код
    // (транзакция создания правила, крон синка) сам решает, что делать дальше.

    /**
     * Создаёт задачу в Bitrix24 (`tasks.task.add`) для правила зарплаты типа
     * `TaskCompletion`. `responsibleBitrixUserId` — сотрудник, на которого
     * оформлено правило; постановщик (`CREATED_BY`) не передаётся явно —
     * им становится технический пользователь вебхука, которым выполнен сам
     * REST-запрос (design.md Decision 2).
     */
    async createTask(
        input: CreateTaskInput,
    ): Promise<{ bitrixTaskId: string }> {
        let payload: BitrixCreateTaskRequest;
        try {
            payload = BitrixCreateTaskRequestSchema.parse(input);
        } catch (error) {
            throw new BadRequestException(
                error instanceof Error ? error.message : String(error),
            );
        }

        try {
            const { data } = await this.bitrix.instance.post<unknown>(
                '/tasks.task.add',
                {
                    fields: {
                        TITLE: payload.title,
                        RESPONSIBLE_ID: payload.responsibleBitrixUserId,
                        ...(payload.description !== undefined
                            ? { DESCRIPTION: payload.description }
                            : {}),
                        DEADLINE: payload.deadline.toISOString(),
                    },
                },
            );
            const parsed = BitrixTaskAddResponseSchema.parse(data);
            return { bitrixTaskId: String(parsed.result.task.id) };
        } catch (error) {
            throw new BadGatewayException(
                `Failed to create task in Bitrix24: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Переводит задачу в статус "Завершена" (`tasks.task.update`,
     * `STATUS = 5`) — используется при удалении/пересборке зарплатного
     * правила `TaskCompletion` (design.md Decision 6).
     */
    async closeTask(bitrixTaskId: string): Promise<void> {
        try {
            const { data } = await this.bitrix.instance.post<unknown>(
                '/tasks.task.update',
                {
                    taskId: bitrixTaskId,
                    fields: { STATUS: BITRIX_TASK_STATUS_COMPLETED },
                },
            );
            BitrixTaskUpdateResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to close task in Bitrix24: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Сдвигает дедлайн существующей задачи (`tasks.task.update`, поле
     * `DEADLINE`) — используется при пересоздании регулярной задачи на новый
     * расчётный период (design.md Decision 4).
     */
    async updateTaskDeadline(
        bitrixTaskId: string,
        deadline: Date,
    ): Promise<void> {
        try {
            const { data } = await this.bitrix.instance.post<unknown>(
                '/tasks.task.update',
                {
                    taskId: bitrixTaskId,
                    fields: { DEADLINE: deadline.toISOString() },
                },
            );
            BitrixTaskUpdateResponseSchema.parse(data);
        } catch (error) {
            throw new BadGatewayException(
                `Failed to update task deadline in Bitrix24: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Опрашивает статусы нескольких задач ОДНИМ batch-запросом (Bitrix24 REST
     * `batch`, тот же приём, что постраничная выгрузка сделок в `_fetchDeals`,
     * но здесь — пакетирование по количеству задач, а не страниц) вместо
     * N вызовов `tasks.task.get`. Пустой массив не делает сетевой вызов.
     *
     * Возвращает СЫРОЙ код статуса Bitrix24 (не доменный VO `TaskStatus` —
     * он заводится отдельно и независимо для `service`/`shop` в разделах
     * 9/14 tasks.md; эта инфраструктурная точка используется обоими
     * направлениями и не должна знать о доменных типах ни одного из них).
     * Ключ отсутствует в результирующей `Map`, если Bitrix24 не вернул
     * задачу по этому id (`result_error` — например, задача удалена вручную
     * в CRM) — вызывающий код (крон 8) сам решает, что делать с пропуском.
     */
    async fetchTaskStatusesBatch(
        bitrixTaskIds: string[],
    ): Promise<Map<string, string>> {
        if (bitrixTaskIds.length === 0) {
            return new Map();
        }

        const cmd: Record<string, string> = {};
        for (const id of bitrixTaskIds) {
            cmd[id] =
                `tasks.task.get?taskId=${encodeURIComponent(id)}&select[]=STATUS`;
        }

        try {
            const { data } = await this.bitrix.instance.post<unknown>(
                '/batch',
                { halt: 0, cmd },
            );
            const parsed = BitrixBatchTaskStatusResponseSchema.parse(data);

            // Разбор ПО ОДНОЙ задаче (safeParse), а не через строгую схему
            // на весь `result.result` сразу — задача, которую Bitrix24 не
            // смог вернуть (удалена/недоступна), приходит под своим ключом в
            // форме, не совпадающей с `{task:{status}}` (например, пустым
            // массивом), и не должна ронять статус всех ОСТАЛЬНЫХ задач
            // батча — см. WHY у BitrixBatchTaskStatusResponseSchema.
            const statuses = new Map<string, string>();
            for (const id of bitrixTaskIds) {
                const entry = BitrixTaskStatusEntrySchema.safeParse(
                    parsed.result.result[id],
                );
                if (entry.success) {
                    statuses.set(id, String(entry.data.task.status));
                }
            }
            return statuses;
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch task statuses from Bitrix24: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
