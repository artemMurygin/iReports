import { Inject, Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { TurnoverCoefficient } from '@/domains/shop/modules/warehouse/domain/value-objects/turnover-coefficient.value-object';
import { GoodsTurnoverWarehouseTotal } from '@/domains/shop/modules/warehouse/domain/value-objects/goods-turnover-warehouse-total.value-object';
import { GOODS_TURNOVER_REPORT_REPOSITORY } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import { PRODUCT_CATEGORY_REPOSITORY } from '@/domains/shop/modules/warehouse/application/ports/product-category/product-category.port';
import type { ProductCategoryRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/product-category/product-category.port';
import {
    toGoodsTurnoverReportResponse,
    GoodsTurnoverReportLineDto,
} from '@/domains/shop/modules/warehouse/application/mappers/goods-turnover-report/to-goods-turnover-report-response';
import { toGoodsTurnoverWarehouseTotalResponse } from '@/domains/shop/modules/warehouse/application/mappers/goods-turnover-report/to-goods-turnover-warehouse-total-response';
import type { GoodsTurnoverWarehouseTotalDto } from '@/domains/shop/modules/warehouse/application/mappers/goods-turnover-report/to-goods-turnover-warehouse-total-response';

// add-department-head-salary-rules, FR5 (BREAKING): ответ меняет форму с голого массива строк на
// {lines, totals} — totals больше не считается на frontend (summarizeShopGoodsTurnoverRows).
export interface GetGoodsTurnoverReportResult {
    lines: GoodsTurnoverReportLineDto[];
    totals: GoodsTurnoverWarehouseTotalDto[];
}

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
        @Inject(PRODUCT_CATEGORY_REPOSITORY)
        private readonly categoryRepository: ProductCategoryRepositoryPort,
    ) {}

    /**
     * Implements FR5 of add-department-head-salary-rules.
     * `totals` — по одной GoodsTurnoverWarehouseTotal на каждый склад, встретившийся в lines,
     * посчитанной статическим `GoodsTurnoverWarehouseTotal.calculate()` только по строкам
     * настоящих корневых категорий (`ProductCategoryRepositoryPort.findRootIds()`).
     */
    async getReport(
        period: Period,
        warehouseId?: string,
    ): Promise<GetGoodsTurnoverReportResult> {
        const [currentLines, previousLines, rootCategoryIds] =
            await Promise.all([
                this.repository.findByPeriod(period),
                this.repository.findByPeriod(period.previous()),
                this.categoryRepository.findRootIds(),
            ]);

        const previousByKey = new Map<string, GoodsTurnoverReportLine>();
        for (const previousLine of previousLines) {
            previousByKey.set(this.key(previousLine), previousLine);
        }

        const lines = warehouseId
            ? currentLines.filter((line) => line.warehouseId === warehouseId)
            : currentLines;

        const dtos = lines.map((line) => {
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

        return {
            lines: dtos,
            totals: this.buildTotals(dtos, rootCategoryIds),
        };
    }

    // Одна запись на каждый склад, встретившийся в dtos (не только на те, у которых есть строка
    // корневой категории) — design.md Decision 6a, тот же принцип, что и у warehouse/service.
    private buildTotals(
        dtos: GoodsTurnoverReportLineDto[],
        rootCategoryIds: ReadonlySet<string>,
    ): GoodsTurnoverWarehouseTotalDto[] {
        const dtosByWarehouse = new Map<string, GoodsTurnoverReportLineDto[]>();
        for (const dto of dtos) {
            const forWarehouse = dtosByWarehouse.get(dto.warehouseId) ?? [];
            forWarehouse.push(dto);
            dtosByWarehouse.set(dto.warehouseId, forWarehouse);
        }

        return Array.from(dtosByWarehouse.entries()).map(
            ([warehouseId, warehouseDtos]) =>
                toGoodsTurnoverWarehouseTotalResponse(
                    GoodsTurnoverWarehouseTotal.calculate(
                        warehouseId,
                        warehouseDtos.filter((dto) =>
                            rootCategoryIds.has(dto.categoryId),
                        ),
                    ),
                ),
        );
    }

    private key(line: GoodsTurnoverReportLine): string {
        return `${line.categoryId}::${line.warehouseId}`;
    }
}
