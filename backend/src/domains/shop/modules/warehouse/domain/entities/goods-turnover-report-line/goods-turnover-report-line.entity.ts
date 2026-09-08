import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { Money } from '../../value-objects/money.value-object';

export interface GoodsTurnoverReportLineProps {
    period: Period;
    categoryId: string;
    warehouseId: string;
    turnoverQuantity: number;
    turnoverSum: Money;
    stockQuantity: number;
    stockSum: Money;
}

export interface CreateGoodsTurnoverReportLineProps {
    id?: AggregateID;
    period: Period;
    categoryId: string;
    warehouseId: string;
    turnoverQuantity: number;
    turnoverSum: Money;
    stockQuantity: number;
    stockSum: Money;
}

// Одна строка отчёта по оборачиваемости — оборот и остаток по категории и
// складу за месяц. Отчёт не моделируется как один агрегат "на весь период":
// каждая строка (категория × склад) — независимый экземпляр агрегата;
// пересчёт периода — массовая операция репозитория (replaceForPeriod), а не
// загрузка одного огромного агрегата с сотнями дочерних строк.
// implements architecture.md/design.md D7.2 of shop-turnover-report
export class GoodsTurnoverReportLine extends AggregateRoot<GoodsTurnoverReportLineProps> {
    declare protected readonly _id: AggregateID;

    static create(
        create: CreateGoodsTurnoverReportLineProps,
    ): GoodsTurnoverReportLine {
        return new GoodsTurnoverReportLine({
            id: create.id ?? randomUUID(),
            props: {
                period: create.period,
                categoryId: create.categoryId,
                warehouseId: create.warehouseId,
                turnoverQuantity: create.turnoverQuantity,
                turnoverSum: create.turnoverSum,
                stockQuantity: create.stockQuantity,
                stockSum: create.stockSum,
            },
        });
    }

    get period(): Period {
        return this.props.period;
    }

    get categoryId(): string {
        return this.props.categoryId;
    }

    get warehouseId(): string {
        return this.props.warehouseId;
    }

    get turnoverQuantity(): number {
        return this.props.turnoverQuantity;
    }

    get turnoverSum(): Money {
        return this.props.turnoverSum;
    }

    get stockQuantity(): number {
        return this.props.stockQuantity;
    }

    get stockSum(): Money {
        return this.props.stockSum;
    }

    validate(): void {
        if (!this.props.categoryId) {
            throw new ArgumentInvalidException(
                'categoryId строки отчёта по оборачиваемости не может быть пустым',
            );
        }
        if (!this.props.warehouseId) {
            throw new ArgumentInvalidException(
                'warehouseId строки отчёта по оборачиваемости не может быть пустым',
            );
        }
        if (this.props.turnoverQuantity < 0) {
            throw new ArgumentInvalidException(
                'turnoverQuantity не может быть отрицательным',
            );
        }
        if (this.props.stockQuantity < 0) {
            throw new ArgumentInvalidException(
                'stockQuantity не может быть отрицательным',
            );
        }
    }
}
