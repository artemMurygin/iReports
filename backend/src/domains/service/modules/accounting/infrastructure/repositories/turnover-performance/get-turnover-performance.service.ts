import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { TURNOVER_REPORT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/turnover-report/turnover-report.port';
import type { TurnoverReportRepositoryPort } from '@/domains/service/modules/accounting/application/ports/turnover-report/turnover-report.port';
import type { TurnoverPerformanceReaderPort } from '@/domains/service/modules/accounting/application/ports/turnover-performance/turnover-performance.port';

// implements FR4 of add-department-head-salary-rules
// Единственная реализация TurnoverPerformanceReaderPort (design.md Decision 6b, architecture.md
// "GetTurnoverPerformanceService") — восстанавливает TurnoverReportSnapshot через
// TURNOVER_REPORT_REPOSITORY (свой собственный, уже изолированный от warehouse репозиторий модуля
// accounting) и считает по нему факт для DepartmentTurnoverBonusEntity. Корневые категории,
// нужные snapshot.total() для "весь склад" (category = null), читает напрямую из
// roappProductCategory собственным Prisma-делегатом этого же класса — та же физическая таблица,
// что читает ProductCategoryRepository модуля warehouse, но без вызова его класса (root
// CLAUDE.md, «Межмодульные зависимости внутри backend» — тот же приём, что уже применён у
// TurnoverReportRepository над goods_turnover_report_lines).
@Injectable()
export class GetTurnoverPerformanceService
    extends PrismaRepository
    implements TurnoverPerformanceReaderPort
{
    constructor(
        db: DatabaseService,
        @Inject(TURNOVER_REPORT_REPOSITORY)
        private readonly turnoverReportRepository: TurnoverReportRepositoryPort,
    ) {
        super(db);
    }

    async findForScope(
        period: string,
        warehouseId: number,
        category: number | null,
    ): Promise<number | null> {
        const snapshot =
            await this.turnoverReportRepository.findByPeriodAndWarehouse(
                period,
                warehouseId,
            );
        if (!snapshot) {
            return null;
        }

        if (category !== null) {
            return snapshot.ratioForCategory(category);
        }

        const rootCategoryIds = await this.findRootCategoryIds();
        return snapshot.total(rootCategoryIds).turnoverRatio;
    }

    private async findRootCategoryIds(): Promise<Set<number>> {
        const rows = await this.client.roappProductCategory.findMany({
            where: { parentId: null },
            select: { id: true },
        });
        return new Set(rows.map((row) => row.id));
    }
}
