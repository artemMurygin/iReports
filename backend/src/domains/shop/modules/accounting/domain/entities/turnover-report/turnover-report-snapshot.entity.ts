import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import {
    GoodsTurnoverWarehouseTotal,
    GoodsTurnoverWarehouseTotalSourceLine,
} from '../../value-objects/goods-turnover-warehouse-total.value-object';

export interface TurnoverReportSnapshotLine extends GoodsTurnoverWarehouseTotalSourceLine {
    categoryId: string;
}

export interface TurnoverReportSnapshotProps {
    period: Period;
    warehouseId: string;
    lines: TurnoverReportSnapshotLine[];
}

export interface TurnoverReportSnapshotCreateProps {
    period: string;
    warehouseId: string;
    lines: TurnoverReportSnapshotLine[];
}

// implements FR4 of add-department-head-salary-rules
// Зеркало domains/service/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity.ts
// для направления shop (design.md Decision 6b) — read-модель accounting/shop для зарплатного
// правила DepartmentTurnoverBonus, восстанавливаемая напрямую из moy_sklad_turnover_report_lines
// через SHOP_TURNOVER_REPORT_REPOSITORY (свой Prisma-делегат, без обращения к
// domains/shop/modules/warehouse — root CLAUDE.md). НЕ агрегат отчёта warehouse — не имеет
// жизненного цикла записи, существует только для чтения зарплатным расчётом.
export class TurnoverReportSnapshot extends AggregateRoot<TurnoverReportSnapshotProps> {
    declare protected readonly _id: AggregateID;

    static create(
        create: TurnoverReportSnapshotCreateProps,
    ): TurnoverReportSnapshot {
        return new TurnoverReportSnapshot({
            id: randomUUID(),
            props: {
                period: Period.create(create.period),
                warehouseId: create.warehouseId,
                lines: create.lines,
            },
        });
    }

    get period(): string {
        return this.props.period.getValue();
    }

    get warehouseId(): string {
        return this.props.warehouseId;
    }

    get lines(): TurnoverReportSnapshotLine[] {
        return this.props.lines;
    }

    // design.md Decision 2 (FR4): "при заданной category — берёт коэффициент конкретной строки из
    // ... самостоятельно восстановленной entity". null — такой категории в снапшоте нет, либо у неё
    // самой коэффициент не рассчитан.
    coefficientForCategory(categoryId: string): number | null {
        return (
            this.props.lines.find((line) => line.categoryId === categoryId)
                ?.coefficient ?? null
        );
    }

    // design.md Decision 2/6b (FR4): "при category = null — берёт агрегат по всему складу из своей
    // TurnoverReportSnapshot" (собственный расчёт, не вызов warehouse). rootCategoryIds — критерий
    // "настоящей корневой" категории не виден на самой строке снапшота, поэтому приходит параметром
    // от вызывающей стороны — тот же приём, что у warehouse/shop
    // GetGoodsTurnoverReportService.buildTotals().
    total(rootCategoryIds: ReadonlySet<string>): GoodsTurnoverWarehouseTotal {
        const rootLines = this.props.lines.filter((line) =>
            rootCategoryIds.has(line.categoryId),
        );
        return GoodsTurnoverWarehouseTotal.calculate(
            this.props.warehouseId,
            rootLines,
        );
    }

    validate(): void {
        // Read-модель без собственных бизнес-инвариантов сверх формы строк (architecture.md,
        // таблица Aggregates) — принадлежность одному (period, warehouseId) гарантируется способом
        // восстановления (репозиторий фильтрует по обоим значениям), а не проверяется здесь.
    }
}
