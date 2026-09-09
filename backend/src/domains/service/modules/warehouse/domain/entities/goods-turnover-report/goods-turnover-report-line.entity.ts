import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GoodsFlowMetric } from '../../value-objects/goods-flow-metric.value-object';

export interface GoodsTurnoverReportLineProps {
    period: Period;
    categoryId: number;
    warehouseId: number;
    outcome: GoodsFlowMetric;
    stock: GoodsFlowMetric;
    // null, пока calcRatio() ещё не вызван, либо когда его результат
    // сознательно не рассчитывается (см. calcRatio) — не 0 (spec.md,
    // "коэффициент оборачиваемости этой позиции не рассчитывается").
    turnoverRatio: number | null;
}

export interface GoodsTurnoverReportLineCreateProps {
    period: string;
    categoryId: number;
    warehouseId: number;
    outcome: GoodsFlowMetric;
    stock: GoodsFlowMetric;
}

// Позиция отчёта по оборачиваемости — одна пара «категория товаров × склад»
// за календарный месяц (spec.md). Child entity агрегата GoodsTurnoverReport,
// не самостоятельный агрегат: жизненный цикл (создание/замена набора строк)
// целиком управляется отчётом, к которому строка принадлежит.
export class GoodsTurnoverReportLine extends Entity<GoodsTurnoverReportLineProps> {
    declare protected readonly _id: AggregateID;

    static create(
        create: GoodsTurnoverReportLineCreateProps,
    ): GoodsTurnoverReportLine {
        return new GoodsTurnoverReportLine({
            id: randomUUID(),
            props: {
                period: Period.create(create.period),
                categoryId: create.categoryId,
                warehouseId: create.warehouseId,
                outcome: create.outcome,
                stock: create.stock,
                turnoverRatio: null,
            },
        });
    }

    get period(): string {
        return this.props.period.getValue();
    }

    get categoryId(): number {
        return this.props.categoryId;
    }

    get warehouseId(): number {
        return this.props.warehouseId;
    }

    get outcome(): GoodsFlowMetric {
        return this.props.outcome;
    }

    get stock(): GoodsFlowMetric {
        return this.props.stock;
    }

    get turnoverRatio(): number | null {
        return this.props.turnoverRatio;
    }

    // Ключ уникальности внутри агрегата GoodsTurnoverReport — пара
    // (категория, склад); период задаётся самим агрегатом и одинаков для
    // всех его строк, поэтому в ключ не входит.
    get categoryWarehouseKey(): string {
        return `${this.props.categoryId}:${this.props.warehouseId}`;
    }

    // spec.md, "Позиция отчёта содержит коэффициент оборачиваемости":
    // расход_₽(текущий) / ((остаток_₽(прошлый) + остаток_₽(текущий)) / 2).
    // stockPreviousSum — сумма остатка в рублях этой же пары
    // категория-склад за предыдущий месяц, либо null, если сохранённых
    // данных за прошлый месяц нет (первый месяц отчёта, либо категория/склад
    // появились только сейчас) — в этом случае коэффициент НЕ рассчитывается,
    // не подставляется нулевой остаток вместо отсутствующих данных
    // (сценарий "Нет сохранённых данных за прошлый месяц"). Средний остаток,
    // равный нулю, тоже даёт null — деление на ноль не выполняется
    // (сценарий "Средний остаток равен нулю"). Мутирует и возвращает
    // turnoverRatio; повторный вызов заменяет ранее сохранённое значение.
    calcRatio(stockPreviousSum: number | null): number | null {
        if (stockPreviousSum === null) {
            this.props.turnoverRatio = null;
            return null;
        }
        const averageStockSum = (stockPreviousSum + this.props.stock.sum) / 2;
        if (averageStockSum === 0) {
            this.props.turnoverRatio = null;
            return null;
        }
        this.props.turnoverRatio = this.props.outcome.sum / averageStockSum;
        return this.props.turnoverRatio;
    }

    validate(): void {
        if (
            !Number.isInteger(this.props.categoryId) ||
            this.props.categoryId <= 0
        ) {
            throw new ArgumentInvalidException(
                `Позиция отчёта по оборачиваемости должна ссылаться на категорию товаров, получено: ${this.props.categoryId}`,
            );
        }
        if (
            !Number.isInteger(this.props.warehouseId) ||
            this.props.warehouseId <= 0
        ) {
            throw new ArgumentInvalidException(
                `Позиция отчёта по оборачиваемости должна ссылаться на склад, получено: ${this.props.warehouseId}`,
            );
        }
    }
}
