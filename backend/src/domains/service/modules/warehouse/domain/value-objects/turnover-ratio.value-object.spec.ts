import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { TurnoverRatioValueObject } from './turnover-ratio.value-object';

// add-department-head-salary-rules, tasks.md задача 3.1: VO для коэффициента оборачиваемости
// с инвариантом value > 0 — переиспользуется зарплатным правилом DepartmentTurnoverBonus (FR4)
// как тип для планового/фактического коэффициента, а не голый number.
describe('TurnoverRatioValueObject', () => {
    // FR4: коэффициент оборачиваемости — всегда положительное число (план/факт).
    it('создаёт значение из положительного числа', () => {
        const ratio = TurnoverRatioValueObject.create(1.75);

        expect(ratio.getValue()).toBe(1.75);
    });

    // FR4: инвариант value > 0 — ноль не является допустимым коэффициентом этого VO.
    it('отклоняет нулевое значение', () => {
        withRequestContext(() => {
            expect(() => TurnoverRatioValueObject.create(0)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    // FR4: инвариант value > 0 — отрицательное значение недопустимо.
    it('отклоняет отрицательное значение', () => {
        withRequestContext(() => {
            expect(() => TurnoverRatioValueObject.create(-0.5)).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});
