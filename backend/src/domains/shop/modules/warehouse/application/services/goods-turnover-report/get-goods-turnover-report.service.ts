import { Inject, Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { TurnoverCoefficient } from '@/domains/shop/modules/warehouse/domain/value-objects/turnover-coefficient.value-object';
import { GOODS_TURNOVER_REPORT_REPOSITORY } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import {
    toGoodsTurnoverReportResponse,
    GoodsTurnoverReportLineDto,
} from '@/domains/shop/modules/warehouse/application/mappers/goods-turnover-report/to-goods-turnover-report-response';

// Читает строки отчёта по оборачиваемости за период и досчитывает
// TurnoverCoefficient по каждой строке при чтении (design.md D8: коэффициент
// не хранится в таблице, т.к. зависит от строки предыдущего периода, которая
// теоретически может быть пересчитана позже).
// implements architecture.md/design.md D8 of shop-turnover-report
@Injectable()
export class GetGoodsTurnoverReportService {
    constructor(
        @Inject(GOODS_TURNOVER_REPORT_REPOSITORY)
        private readonly repository: GoodsTurnoverReportRepositoryPort,
    ) {}

    async getReport(
        period: Period,
        warehouseId?: string,
    ): Promise<GoodsTurnoverReportLineDto[]> {
        const [currentLines, previousLines] = await Promise.all([
            this.repository.findByPeriod(period),
            this.repository.findByPeriod(period.previous()),
        ]);

        const previousByKey = new Map<string, GoodsTurnoverReportLine>();
        for (const previousLine of previousLines) {
            previousByKey.set(this.key(previousLine), previousLine);
        }

        const lines = warehouseId
            ? currentLines.filter((line) => line.warehouseId === warehouseId)
            : currentLines;

        return lines.map((line) => {
            // Пары без строки за предыдущий период (первый месяц данных или
            // новая категория) сознательно передают `null` в
            // TurnoverCoefficient.calculate — коэффициент останется
            // недоступным (isAvailable() === false), а не станет 0.
            const previousLine = previousByKey.get(this.key(line)) ?? null;
            const coefficient = TurnoverCoefficient.calculate(
                line.turnoverSum,
                previousLine ? previousLine.stockSum : null,
                line.stockSum,
            );

            return toGoodsTurnoverReportResponse(line, coefficient);
        });
    }

    private key(line: GoodsTurnoverReportLine): string {
        return `${line.categoryId}::${line.warehouseId}`;
    }
}
