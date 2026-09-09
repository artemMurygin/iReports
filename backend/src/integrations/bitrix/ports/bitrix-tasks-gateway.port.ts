/**
 * Раздел 6 tasks.md (add-task-based-salary-rule): единая точка входа в
 * write-методы Bitrix24 Tasks API (`tasks.task.*`) для доменов `service` и
 * `shop` — по структурному образцу `RoappGateway`/`ROAPP_GATEWAY`
 * (`domains/service/integrations/roapp-gateway/roapp-gateway.port.ts`):
 * токен объявлен в этом же файле, что и интерфейс порта.
 *
 * В отличие от `RoappGateway`, реализация (`BitrixTasksGatewayAdapter`)
 * ничего не скрывает за собой (нет двух транспортов) — она лишь переносит
 * границу зависимости из доменных модулей `service`/`shop` в
 * `BitrixService` (design.md Decision 2: новый класс-клиент не заводится,
 * write-методы `tasks.task.*` живут на существующем `BitrixService`).
 */
export interface CreateBitrixTaskInput {
    responsibleBitrixUserId: number;
    title: string;
    description?: string;
    deadline: Date;
}

export interface BitrixTasksGatewayPort {
    createTask(input: CreateBitrixTaskInput): Promise<{ bitrixTaskId: string }>;
    closeTask(bitrixTaskId: string): Promise<void>;
    updateDeadline(bitrixTaskId: string, deadline: Date): Promise<void>;
}

export const BITRIX_TASKS_GATEWAY = Symbol('BITRIX_TASKS_GATEWAY');
