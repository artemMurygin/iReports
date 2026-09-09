import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface GoodsFlowMetricProps {
    quantity: number;
    sum: number;
}

// Пара «количество (шт) + сумма (₽ целыми рублями, см.
// domains/service/modules/accounting/domain/services/money.ts) — расход или
// остаток товара за период (spec.md, "Позиция отчёта содержит расход и
// остаток в штуках и в рублях"). Оба поля всегда меняются вместе (описывают
// одно и то же движение/состояние товара с двух сторон измерения) и
// разделяют общий инвариант неотрицательности — value object, а не два
// голых Int поля entity (backend/CLAUDE.md, "Value objects"). Immutable:
// как и любой ValueObject, после create() не имеет сеттеров — пересчёт
// (например, в GoodsTurnoverReportLine) заменяет весь VO новым инстансом.
export class GoodsFlowMetric extends ValueObject<GoodsFlowMetricProps> {
    static create(quantity: number, sum: number): GoodsFlowMetric {
        if (!Number.isInteger(quantity) || quantity < 0) {
            throw new ArgumentInvalidException(
                `Количество должно быть целым неотрицательным числом, получено: ${quantity}`,
            );
        }
        if (!Number.isInteger(sum) || sum < 0) {
            throw new ArgumentInvalidException(
                `Сумма должна быть целым неотрицательным числом рублей, получено: ${sum}`,
            );
        }
        return new GoodsFlowMetric({ quantity, sum });
    }

    // Категория/склад без движения товара за период (spec.md, "Категория без
    // движения товара — позиция с нулевыми показателями") — позиция отчёта
    // всё равно строится, просто с нулевыми метриками.
    static zero(): GoodsFlowMetric {
        return new GoodsFlowMetric({ quantity: 0, sum: 0 });
    }

    get quantity(): number {
        return this.props.quantity;
    }

    get sum(): number {
        return this.props.sum;
    }
}
