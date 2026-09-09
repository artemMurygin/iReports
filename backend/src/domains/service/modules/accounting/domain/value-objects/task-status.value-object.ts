import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { BITRIX_TASK_STATUS_COMPLETED } from '@/integrations/bitrix/schema';

// Раздел 9 tasks.md (add-task-based-salary-rule): сырой код статуса задачи
// Bitrix24 (tasks.task.get), сохранённый на SalaryTask.taskStatus (Prisma-
// модель salary-task.prisma, задача 1.1) — то же значение, что пишет
// SalaryTaskStatusSyncService (src/sync/bitrix-tasks/, раздел 8) напрямую в
// БД в обход домена. isDone() — единственный домену нужный вопрос про статус
// (spec service/accounting, shop/accounting: «строка отсутствует в отчёте,
// пока задача не выполнена»), сравнение по буквальному коду "Завершена"
// (BITRIX_TASK_STATUS_COMPLETED = 5, src/integrations/bitrix/schema.ts —
// тот же источник истины, что уже использует SalaryTaskStatusSyncService,
// не дублируем магическое число здесь).
//
// Импорт доменным VO константы из src/integrations/bitrix/ — тот же приём,
// что design.md Decision 7 уже применил к buildBitrixTaskLink (раздел 7):
// направление-агностичная инфраструктура Bitrix24 Tasks API используется
// напрямую доменным слоем service/shop, отдельного дублирования кода/
// констант под каждое направление не заводится.
export class TaskStatus extends ValueObject<string> {
    static fromRaw(code: string): TaskStatus {
        if (!code) {
            throw new ArgumentInvalidException(
                'Код статуса задачи Bitrix24 не может быть пустым',
            );
        }
        return new TaskStatus({ value: code });
    }

    get code(): string {
        return this.unpack();
    }

    isDone(): boolean {
        return this.code === String(BITRIX_TASK_STATUS_COMPLETED);
    }
}
