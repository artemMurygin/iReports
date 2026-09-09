import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import {
    DuplicateGoodsTurnoverReportLineException,
    GoodsTurnoverReportLinePeriodMismatchException,
} from '../../exceptions/goods-turnover-report.exception';
import { GoodsTurnoverReportLine } from './goods-turnover-report-line.entity';

export interface GoodsTurnoverReportProps {
    period: Period;
    lines: GoodsTurnoverReportLine[];
}

export interface GoodsTurnoverReportCreateProps {
    period: string;
    lines: GoodsTurnoverReportLine[];
}

// Отчёт по оборачиваемости товаров за один календарный месяц (spec.md,
// "Отчётный период идентифицируется календарным месяцем") — агрегат,
// собирающий позиции (GoodsTurnoverReportLine) всех пар категория×склад за
// месяц. Строится целиком заново при каждом пересчёте (design.md D4: строки
// полностью перезаписываются) — BuildGoodsTurnoverReportService (задача 9)
// вызывает create() с полным набором строк, а не добавляет их по одной; на
// снэпшот закрытого месяца (design.md D7) агрегат не тратит отдельного
// поведения — снэпшот фиксируется на уровне хранения строк, а не структуры
// этого класса.
export class GoodsTurnoverReport extends AggregateRoot<GoodsTurnoverReportProps> {
    declare protected readonly _id: AggregateID;

    static create(create: GoodsTurnoverReportCreateProps): GoodsTurnoverReport {
        return new GoodsTurnoverReport({
            id: randomUUID(),
            props: {
                period: Period.create(create.period),
                lines: create.lines,
            },
        });
    }

    get period(): string {
        return this.props.period.getValue();
    }

    get lines(): GoodsTurnoverReportLine[] {
        return this.props.lines;
    }

    // Инвариант агрегата: в пределах периода не может быть двух позиций на
    // одну и ту же пару (categoryId, warehouseId) — spec.md, "Отчёт строится
    // отдельно по каждому складу" и "Отчёт покрывает все категории..."
    // подразумевают ровно одну позицию на пару категория×склад. Заодно
    // проверяет, что все строки принадлежат периоду самого отчёта — защита
    // от сборки отчёта из строк разных месяцев.
    validate(): void {
        const period = this.props.period.getValue();
        const seen = new Set<string>();
        for (const line of this.props.lines) {
            if (line.period !== period) {
                throw new GoodsTurnoverReportLinePeriodMismatchException(
                    period,
                    line.period,
                );
            }
            const key = line.categoryWarehouseKey;
            if (seen.has(key)) {
                throw new DuplicateGoodsTurnoverReportLineException(
                    period,
                    line.categoryId,
                    line.warehouseId,
                );
            }
            seen.add(key);
        }
    }
}
