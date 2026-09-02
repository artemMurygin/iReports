import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// Сумма вознаграждения за полное выполнение правила-задачи Bitrix24
// (design.md change salary-rule-bitrix-task, Decision 2 — единственный вид
// вознаграждения TaskCompleted теперь фиксированная сумма, FloatPercent
// удалён). Value object, а не голый number в config: у суммы есть
// собственный инвариант (конечное неотрицательное число, см.
// taskCompletedSalaryConfigSchema.rewardAmount в contracts), который обязан
// действовать не только на HTTP-границе, но и при восстановлении правила из
// БД (SalaryRuleMapper.toDomain, прямой `new` в обход create() — см.
// backend/CLAUDE.md, раздел "Value objects").
export class TaskRewardAmount extends ValueObject<number> {
    static create(value: number): TaskRewardAmount {
        if (!Number.isFinite(value)) {
            throw new ArgumentInvalidException(
                'Сумма вознаграждения за задачу должна быть числом',
            );
        }
        if (value < 0) {
            throw new ArgumentInvalidException(
                'Сумма вознаграждения за задачу не может быть отрицательной',
            );
        }
        return new TaskRewardAmount({ value });
    }

    getValue(): number {
        return this.props.value;
    }
}
