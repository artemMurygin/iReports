import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { TurnoverReportRepositoryPort } from '@/domains/service/modules/accounting/application/ports/turnover-report/turnover-report.port';
import { TurnoverReportSnapshot } from '@/domains/service/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity';

// implements FR4 of add-department-head-salary-rules
// Единственная точка чтения goods_turnover_report_lines внутри модуля accounting (design.md
// Decision 6b) — собственный Prisma-делегат этого модуля. Физически та же таблица, что читает
// GoodsTurnoverReportLineRepository модуля warehouse, но без единого класса/вызова между ними (root
// CLAUDE.md, «Межмодульные зависимости внутри backend» — тот же приём, что уже применяется между
// service/shop к общим таблицам вроде SalesPlan, здесь распространённый на пару модулей одного
// домена).
@Injectable()
export class TurnoverReportRepository
    extends PrismaRepository
    implements TurnoverReportRepositoryPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findByPeriodAndWarehouse(
        period: string,
        warehouseId: number,
    ): Promise<TurnoverReportSnapshot | null> {
        const records = await this.client.goodsTurnoverReportLine.findMany({
            where: { period, warehouseId },
        });
        if (records.length === 0) {
            return null;
        }

        return TurnoverReportSnapshot.create({
            period,
            warehouseId,
            lines: records.map((record) => ({
                categoryId: record.categoryId,
                outcomeSum: record.outcomeSum,
                stockSum: record.stockSum,
                stockQuantity: record.stockQuantity,
                turnoverRatio: record.turnoverRatio,
            })),
        });
    }
}
