import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// implements FR4 of add-department-head-salary-rules
// Коэффициент оборачиваемости как самостоятельный value object, а не голый `number` — используется
// зарплатным правилом «руководителя направления» DepartmentTurnoverBonus
// (add-department-head-salary-rules, FR4, design.md Decision 2) как тип для планового
// (`config.planTurnoverRatio`) и фактического коэффициента склада/категории. Инвариант `value > 0`:
// ноль/отрицательное значение не являются допустимым плановым или фактическим коэффициентом этого
// правила (в отличие от `turnoverRatio` строки отчёта «Оборачиваемость», где `0` — легитимный факт
// отсутствия оборота при наличии остатка, а `null` — отдельно означает «не рассчитан» — см.
// `GoodsTurnoverReportLine.calcRatio`; тот случай этим VO не оборачивается).
export class TurnoverRatioValueObject extends ValueObject<number> {
    static create(value: number): TurnoverRatioValueObject {
        if (!(value > 0)) {
            throw new ArgumentInvalidException(
                `Коэффициент оборачиваемости должен быть положительным числом, получено: ${value}`,
            );
        }
        return new TurnoverRatioValueObject({ value });
    }

    getValue(): number {
        return this.props.value;
    }
}
