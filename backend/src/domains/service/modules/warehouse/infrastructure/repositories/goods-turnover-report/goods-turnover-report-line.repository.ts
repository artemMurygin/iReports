import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { GoodsTurnoverReportLineRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report-line.port';
import { GoodsTurnoverReportLine } from '@/domains/service/modules/warehouse/domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsTurnoverReportLineMapper } from '../../mappers/goods-turnover-report/goods-turnover-report-line.mapper';

@Injectable()
export class GoodsTurnoverReportLineRepository
    extends PrismaRepository
    implements GoodsTurnoverReportLineRepositoryPort
{
    private readonly mapper = new GoodsTurnoverReportLineMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByPeriod(period: string): Promise<GoodsTurnoverReportLine[]> {
        const records = await this.client.goodsTurnoverReportLine.findMany({
            where: { period },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    // Замена набора строк периода — delete + createMany внутри одной
    // транзакции write() (см. AccountingPeriodSnapshotRepository.saveAll,
    // тот же приём: PrismaRepository.write оборачивает оба вызова в
    // db.withTransaction, TransactionClient не имеет собственного
    // $transaction()).
    async replaceAll(
        period: string,
        lines: GoodsTurnoverReportLine[],
    ): Promise<void> {
        await this.write(null, async (client) => {
            await client.goodsTurnoverReportLine.deleteMany({
                where: { period },
            });
            if (lines.length > 0) {
                await client.goodsTurnoverReportLine.createMany({
                    data: lines.map((line) => this.mapper.toPersistence(line)),
                });
            }
        });
    }
}
