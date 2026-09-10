import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SHOP_TURNOVER_REPORT_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/turnover-report/turnover-report.port';
import type { ShopTurnoverReportRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/turnover-report/turnover-report.port';
import type { ShopTurnoverPerformanceReaderPort } from '@/domains/shop/modules/accounting/application/ports/turnover-performance/turnover-performance.port';

// implements FR4 of add-department-head-salary-rules
// Зеркало
// domains/service/modules/accounting/infrastructure/repositories/turnover-performance/get-turnover-performance.service.ts
// для shop (design.md Decision 5 — независимая реализация по домену) — единственная реализация
// ShopTurnoverPerformanceReaderPort: восстанавливает TurnoverReportSnapshot через
// SHOP_TURNOVER_REPORT_REPOSITORY и считает по нему факт для DepartmentTurnoverBonusEntity (shop).
// Корневые категории, нужные snapshot.total() для "весь склад" (category = null), читает напрямую
// из moySkladProductFolder собственным Prisma-делегатом этого же класса — та же физическая
// таблица, что читает справочник каталога модуля warehouse, но без вызова его класса (root
// CLAUDE.md, «Межмодульные зависимости внутри backend»).
@Injectable()
export class GetShopTurnoverPerformanceService
    extends PrismaRepository
    implements ShopTurnoverPerformanceReaderPort
{
    constructor(
        db: DatabaseService,
        @Inject(SHOP_TURNOVER_REPORT_REPOSITORY)
        private readonly turnoverReportRepository: ShopTurnoverReportRepositoryPort,
    ) {
        super(db);
    }

    async findForScope(
        period: string,
        warehouseId: string,
        category: string | null,
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
            return snapshot.coefficientForCategory(category);
        }

        const rootCategoryIds = await this.findRootCategoryIds();
        return snapshot.total(rootCategoryIds).coefficient;
    }

    private async findRootCategoryIds(): Promise<Set<string>> {
        const rows = await this.client.moySkladProductFolder.findMany({
            where: { parentId: null },
            select: { id: true },
        });
        return new Set(rows.map((row) => row.id));
    }
}
