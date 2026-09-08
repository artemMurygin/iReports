import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import { GoodsTurnoverReportLineMapper } from '../../mappers/goods-turnover-report/goods-turnover-report.mapper';

// Единственная точка записи/чтения moy_sklad_turnover_report_lines (см.
// architecture.md, GoodsTurnoverReportRepository). replaceForPeriod — по
// образцу ShopSalaryAccrualRepository.saveAll (../salary-accrual в
// domains/shop/modules/accounting): полная замена строк периода одной
// Prisma-транзакцией через PrismaRepository.write() (deleteMany + createMany),
// а не через отдельно инжектируемый UNIT_OF_WORK — здесь всего один
// репозиторий/агрегат задействован, транзакционность нужна только внутри
// одного метода, поэтому used-of-work в application-слое (как в
// CQRS-хендлерах, координирующих несколько репозиториев) не требуется.
@Injectable()
export class GoodsTurnoverReportRepository
    extends PrismaRepository
    implements GoodsTurnoverReportRepositoryPort
{
    private readonly mapper = new GoodsTurnoverReportLineMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByPeriod(period: Period): Promise<GoodsTurnoverReportLine[]> {
        const records = await this.client.moySkladTurnoverReportLine.findMany({
            where: { period: period.getValue() },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async replaceForPeriod(
        period: Period,
        lines: GoodsTurnoverReportLine[],
    ): Promise<void> {
        const persisted = lines.map((line) => this.mapper.toPersistence(line));
        await this.write(null, async (client) => {
            await client.moySkladTurnoverReportLine.deleteMany({
                where: { period: period.getValue() },
            });
            if (persisted.length === 0) {
                return;
            }
            await client.moySkladTurnoverReportLine.createMany({
                data: persisted,
            });
        });
    }
}
