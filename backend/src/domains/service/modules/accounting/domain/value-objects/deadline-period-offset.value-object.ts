import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// Смещение дедлайна регулярной задачи TaskCompletion относительно расчётного периода, к которому
// она относится (recurring-task-deadline-offset, design.md решение 2/3): 0 — дедлайн внутри
// месяца самого периода (прежнее поведение), 1..3 — на 1..3 месяца вперёд. Верхняя граница 3 —
// защита от опечатки (например, ввода года вместо числа периодов), см. design.md.
//
// В самом config правила (TaskCompletionSalaryConfig) поле хранится как обычное number, а не как
// этот VO — тот же паттерн, что и percentBorders/FloatPercentSchedule у ProductSoldEntity (shop):
// VO конструируется транзитно (buildTaskCompletionConfig) только чтобы бросить исключение при
// невалидном значении, не персистируется как объект.
export class DeadlinePeriodOffset extends ValueObject<number> {
    static create(value: number): DeadlinePeriodOffset {
        if (!Number.isInteger(value) || value < 0 || value > 3) {
            throw new ArgumentInvalidException(
                `Смещение периода дедлайна должно быть целым числом от 0 до 3, получено: ${value}`,
            );
        }
        return new DeadlinePeriodOffset({ value });
    }

    getValue(): number {
        return this.props.value;
    }
}
