import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import {
    GoodsTurnoverWarehouseTotal,
    GoodsTurnoverWarehouseTotalSourceLine,
} from '../../value-objects/goods-turnover-warehouse-total.value-object';

export interface TurnoverReportSnapshotLine extends GoodsTurnoverWarehouseTotalSourceLine {
    categoryId: number;
}

export interface TurnoverReportSnapshotProps {
    period: Period;
    warehouseId: number;
    lines: TurnoverReportSnapshotLine[];
}

export interface TurnoverReportSnapshotCreateProps {
    period: string;
    warehouseId: number;
    lines: TurnoverReportSnapshotLine[];
}

// implements FR4 of add-department-head-salary-rules
// Read-модель модуля accounting для зарплатного правила DepartmentTurnoverBonus (design.md
// Decision 6b) — снапшот строк отчёта «Оборачиваемость» одного склада за один период,
// восстанавливаемый напрямую из goods_turnover_report_lines через TURNOVER_REPORT_REPOSITORY (свой
// Prisma-делегат, без обращения к модулю warehouse — root CLAUDE.md, «Межмодульные зависимости
// внутри backend»). НЕ агрегат отчёта warehouse (GoodsTurnoverReport) — не имеет жизненного цикла
// записи и структурных инвариантов отчёта (уникальность пары категория-склад и т.п.), существует
// только для чтения зарплатным расчётом; принадлежность одному (period, warehouseId) обеспечивает
// сам способ восстановления (findByPeriodAndWarehouse), а не отдельная проверка на entity.
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

    get warehouseId(): number {
        return this.props.warehouseId;
    }

    get lines(): TurnoverReportSnapshotLine[] {
        return this.props.lines;
    }

    // design.md Decision 2 (FR4): "при заданной category — берёт коэффициент конкретной строки из
    // ... самостоятельно восстановленной entity". null — такой категории в снапшоте нет, либо у неё
    // самой коэффициент не рассчитан (та же семантика null, что у строки отчёта warehouse).
    ratioForCategory(categoryId: number): number | null {
        return (
            this.props.lines.find((line) => line.categoryId === categoryId)
                ?.turnoverRatio ?? null
        );
    }

    // design.md Decision 2/6b (FR4): "при category = null — берёт агрегат по всему складу из своей
    // TurnoverReportSnapshot" (собственный расчёт, не вызов warehouse). rootCategoryIds — критерий
    // "настоящей корневой" категории не виден на самой строке снапшота (только в справочнике
    // категорий), поэтому приходит параметром от вызывающей стороны — тот же приём, что у
    // GoodsTurnoverReport.totals() в warehouse/service.
    total(rootCategoryIds: ReadonlySet<number>): GoodsTurnoverWarehouseTotal {
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
