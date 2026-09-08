import { ValueObject } from '@/shared/domain/value-object.base';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия VO
// для направления shop (зеркало domains/service/modules/accounting/domain/
// value-objects/task-status.value-object.ts, раздел 9, issue #57 запрещает
// переиспользование). Оборачивает СЫРОЙ код статуса задачи Bitrix24 (тот
// же формат, что возвращает BitrixService.fetchTaskStatusesBatch и что
// хранится в SalaryTask.taskStatus — String, а не числом).
//
// Код "5" — статус "Завершена" в Bitrix24 Tasks API (tasks.task.get,
// поле STATUS). Тот же код уже зафиксирован в проекте как
// BITRIX_TASK_STATUS_COMPLETED (src/integrations/bitrix/schema.ts, раздел
// 5 tasks.md, design.md Decision 2) — здесь он не импортируется напрямую
// из src/integrations/bitrix, потому что domain-слой не должен зависеть от
// инфраструктурного модуля интеграции (backend/CLAUDE.md, «Dependency
// direction: domain never imports from application/infrastructure/
// interface»); значение продублировано как часть словаря домена, а не
// связано ссылкой. Проверено через mcp__claude_ai_Bitrix_24__
// bitrix-method-details (tasks.task.get/tasks.task.add/tasks.task.complete)
// — официальная REST-документация не публикует явную таблицу «код →
// название» для STATUS (только конкретные примеры ответа, где "status":
// "2" соответствует свежесозданной задаче, и отдельный метод
// tasks.task.complete, переводящий задачу именно в статус «Завершена»);
// код "5" для «Завершена» — уже принятое и используемое в этом change
// значение (раздел 5), здесь переиспользуется для консистентности, а не
// придумывается заново.
export class ShopTaskStatus extends ValueObject<string> {
    private static readonly DONE_RAW_CODE = '5';
    // "2" — код свежесозданной задачи Bitrix24 (см. пример ответа
    // tasks.task.add в комментарии выше файла: `"status": "2"`).
    private static readonly NEW_RAW_CODE = '2';

    static fromRaw(rawStatus: string): ShopTaskStatus {
        return new ShopTaskStatus({ value: rawStatus });
    }

    // Статус "Завершена" — используется тестовыми фикстурами/местами, где
    // нужен именно готовый done-статус (isDone() === true), а не сырой код
    // "5" построчно.
    static done(): ShopTaskStatus {
        return new ShopTaskStatus({ value: ShopTaskStatus.DONE_RAW_CODE });
    }

    // Раздел 16 tasks.md (add-task-based-salary-rule) — статус только что
    // созданной в Bitrix24 задачи (EnsureShopSalaryTaskForPeriodService).
    // Bitrix24 создаёт новую задачу НЕ в статусе «Завершена», поэтому здесь
    // нужен именно не-done код (в отличие от done() выше) — фактический код
    // придёт из ответа tasks.task.add и будет перезаписан первым же
    // поллингом (SalaryTaskStatusSyncCron, раздел 8), поэтому конкретное
    // значение не критично, лишь бы isDone() было ложным.
    static newlyCreated(): ShopTaskStatus {
        return new ShopTaskStatus({ value: ShopTaskStatus.NEW_RAW_CODE });
    }

    getValue(): string {
        return this.props.value;
    }

    isDone(): boolean {
        return this.props.value === ShopTaskStatus.DONE_RAW_CODE;
    }
}
