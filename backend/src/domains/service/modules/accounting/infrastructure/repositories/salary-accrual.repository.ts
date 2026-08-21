import { Injectable } from '@nestjs/common';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SalaryAccrualMapper } from '../mappers/salary-accrual.mapper';

@Injectable()
export class SalaryAccrualRepository
    extends PrismaRepository
    implements SalaryAccrualRepositoryPort
{
    private readonly mapper = new SalaryAccrualMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async saveAll(
        direction: AccountingDirection,
        period: string,
        accruals: SalaryAccrual[],
    ): Promise<void> {
        const persisted = accruals.map((accrual) =>
            this.mapper.toPersistence(accrual),
        );
        // Все операции уже идут внутри транзакции, которую открывает
        // write() (см. PrismaRepository.write) — последовательные вызовы,
        // а не вложенный $transaction (тот же приём, что и в
        // AccountingPeriodSnapshotRepository.saveAll). Строки удаляются
        // каскадом вместе с документами (onDelete: Cascade).
        await this.write(null, async (client) => {
            await client.salaryAccrual.deleteMany({
                where: { direction, period },
            });
            if (persisted.length === 0) {
                return;
            }
            await client.salaryAccrual.createMany({
                data: persisted.map((item) => item.accrual),
            });
            const lines = persisted.flatMap((item) => item.lines);
            if (lines.length > 0) {
                await client.salaryAccrualLine.createMany({ data: lines });
            }
        });
    }

    async findById(id: string): Promise<SalaryAccrual | null> {
        const record = await this.client.salaryAccrual.findUnique({
            where: { id },
            include: { lines: true },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<SalaryAccrual[]> {
        const records = await this.client.salaryAccrual.findMany({
            where: { direction, period },
            include: { lines: true },
            orderBy: { employeeId: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findStatusByKey(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<SalaryAccrualStatus | null> {
        const record = await this.client.salaryAccrual.findUnique({
            where: {
                direction_period_employeeId: { direction, period, employeeId },
            },
            select: { status: true },
        });
        return record?.status ?? null;
    }

    async deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void> {
        await this.write(null, (client) =>
            client.salaryAccrual.deleteMany({ where: { direction, period } }),
        );
    }
}
