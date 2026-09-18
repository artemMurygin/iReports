import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// recurring-task-deadline-offset, tasks.md раздел 5 (design.md решение 2) —
// зеркало одноимённого VO направления service (domains/service/modules/
// accounting/domain/value-objects/deadline-period-offset.value-object.ts,
// независимая копия — не импортируется отсюда, см. backend/CLAUDE.md
// «Межмодульные зависимости внутри backend»).
//
// Смещение периода дедлайна регулярной задачи правила "за выполнение
// задачи" (TaskCompletionShopSalaryConfig.deadlinePeriodOffset) — сколько
// расчётных периодов вперёд от периода задачи отстоит месяц дедлайна.
// В конфиге правила поле хранится как обычное число (см. WHY у
// TaskCompletionShopSalaryConfig.deadlinePeriodOffset в
// domain/types/salary-rule.types.ts) — этот VO строится ТРАНЗИТНО только
// для проверки инварианта диапазона (0..3, целое), тот же приём, что и у
// FloatPercentSchedule.create() в ProductSoldEntity.validate() /
// calculate(): валидирует и бросает исключение, но не персистируется как
// объект.
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
