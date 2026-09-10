import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Period } from '@/shared/domain/period.value-object';
import { ShopTurnoverReportRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/turnover-report/turnover-report.port';
import { TurnoverReportSnapshot } from '@/domains/shop/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity';
import { resolveTurnoverCoefficient } from '@/domains/shop/modules/accounting/domain/services/turnover-coefficient';

// implements FR4 of add-department-head-salary-rules
// Единственная точка чтения moy_sklad_turnover_report_lines внутри модуля accounting/shop
// (design.md Decision 6b) — собственный Prisma-делегат этого модуля. Физически та же таблица, что
// читает GoodsTurnoverReportRepository модуля warehouse, но без единого класса/вызова между ними
// (root CLAUDE.md, «Межмодульные зависимости внутри backend»).
//
// В отличие от goods_turnover_report_lines (service), moy_sklad_turnover_report_lines не хранит
// коэффициент (design.md, Context: "коэффициент оборачиваемости не персистится — вычисляется при
// чтении") — поэтому читает и текущий, и предыдущий период тем же собственным Prisma-делегатом и
// досчитывает коэффициент каждой строки формулой resolveTurnoverCoefficient (дублирует
// TurnoverCoefficient.calculate модуля warehouse независимо, см. WHY там).
@Injectable()
export class ShopTurnoverReportRepository
    extends PrismaRepository
    implements ShopTurnoverReportRepositoryPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findByPeriodAndWarehouse(
        period: string,
        warehouseId: string,
    ): Promise<TurnoverReportSnapshot | null> {
        const periodValue = Period.create(period);

        const [currentRecords, previousRecords] = await Promise.all([
            this.client.moySkladTurnoverReportLine.findMany({
                where: { period: periodValue.getValue(), warehouseId },
            }),
            this.client.moySkladTurnoverReportLine.findMany({
                where: {
                    period: periodValue.previous().getValue(),
                    warehouseId,
                },
            }),
        ]);
        if (currentRecords.length === 0) {
            return null;
        }

        const previousStockByCategory = new Map(
            previousRecords.map((record) => [
                record.categoryId,
                record.stockSum,
            ]),
        );

        return TurnoverReportSnapshot.create({
            period: periodValue.getValue(),
            warehouseId,
            lines: currentRecords.map((record) => ({
                categoryId: record.categoryId,
                turnoverSum: record.turnoverSum,
                stockSum: record.stockSum,
                stockQuantity: record.stockQuantity,
                coefficient: resolveTurnoverCoefficient(
                    record.turnoverSum,
                    previousStockByCategory.get(record.categoryId) ?? null,
                    record.stockSum,
                ),
            })),
        });
    }
}
