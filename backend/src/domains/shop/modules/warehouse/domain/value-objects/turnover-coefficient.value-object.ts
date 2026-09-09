import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Money } from './money.value-object';

interface TurnoverCoefficientProps {
    ratio: number | null;
}

// Коэффициент оборачиваемости — инкапсулирует формулу из design.md D8 и явно
// различает "коэффициент = 0" (реальный ноль оборота при наличии остатка) от
// "коэффициент не рассчитан" (нет данных прошлого периода для сравнения, либо
// оба остатка нулевые — деление на ноль). Голый `number | null` в этом месте
// легко перепутать с ошибкой при чтении отчёта, поэтому используется VO с
// isAvailable().
// implements design.md D8 of shop-turnover-report
export class TurnoverCoefficient extends ValueObject<TurnoverCoefficientProps> {
    static calculate(
        turnoverSum: Money,
        previousStockSum: Money | null,
        currentStockSum: Money,
    ): TurnoverCoefficient {
        if (previousStockSum === null) {
            return new TurnoverCoefficient({ ratio: null });
        }

        const averageStock =
            (previousStockSum.getValue() + currentStockSum.getValue()) / 2;

        if (averageStock === 0) {
            return new TurnoverCoefficient({ ratio: null });
        }

        return new TurnoverCoefficient({
            ratio: turnoverSum.getValue() / averageStock,
        });
    }

    isAvailable(): boolean {
        return this.props.ratio !== null;
    }

    getValue(): number {
        if (this.props.ratio === null) {
            throw new ArgumentInvalidException(
                'Коэффициент оборачиваемости недоступен для этой пары категории и склада — нет данных для сравнения',
            );
        }
        return this.props.ratio;
    }
}
