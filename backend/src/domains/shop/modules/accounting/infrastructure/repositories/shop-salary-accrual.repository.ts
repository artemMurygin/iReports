import { Injectable } from '@nestjs/common';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/shop-salary-accrual.entity';
import { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { ShopSalaryAccrualMapper } from '../mappers/shop-salary-accrual.mapper';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// salary-accrual.repository.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop: те же общие Prisma-таблицы
// salary_accruals/salary_accrual_lines/salary_accrual_line_adjustments, тот
// же Prisma-делегат, но всегда с фиксированным direction: 'shop'.
@Injectable()
export class ShopSalaryAccrualRepository
    extends PrismaRepository
    implements ShopSalaryAccrualRepositoryPort
{
    private readonly mapper = new ShopSalaryAccrualMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async saveAll(
        period: string,
        accruals: ShopSalaryAccrual[],
    ): Promise<void> {
        const persisted = accruals.map((accrual) =>
            this.mapper.toPersistence(accrual),
        );
        await this.write(null, async (client) => {
            await client.salaryAccrual.deleteMany({
                where: { direction: 'shop', period },
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

    async findById(id: string): Promise<ShopSalaryAccrual | null> {
        const record = await this.client.salaryAccrual.findUnique({
            where: { id, direction: 'shop' },
            include: { lines: { include: { adjustments: true } } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByIds(ids: string[]): Promise<ShopSalaryAccrual[]> {
        if (ids.length === 0) {
            return [];
        }
        const records = await this.client.salaryAccrual.findMany({
            where: { id: { in: ids }, direction: 'shop' },
            include: { lines: { include: { adjustments: true } } },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByPeriod(period: string): Promise<ShopSalaryAccrual[]> {
        const records = await this.client.salaryAccrual.findMany({
            where: { direction: 'shop', period },
            include: { lines: { include: { adjustments: true } } },
            orderBy: { employeeId: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async save(accrual: ShopSalaryAccrual): Promise<void> {
        const adjustments = this.mapper.adjustmentsToPersistence(accrual);
        await this.write(accrual, async (client) => {
            await client.salaryAccrual.update({
                where: { id: accrual.id },
                data: { status: accrual.status },
            });
            for (const line of accrual.lines) {
                await client.salaryAccrualLine.update({
                    where: { id: line.id },
                    data: { amount: line.amount, status: line.status },
                });
            }
            if (adjustments.length > 0) {
                await client.salaryAccrualLineAdjustment.createMany({
                    data: adjustments,
                    skipDuplicates: true,
                });
            }
        });
    }

    async findStatusByKey(
        period: string,
        employeeId: number,
    ): Promise<SalaryAccrualStatus | null> {
        const record = await this.client.salaryAccrual.findUnique({
            where: {
                direction_period_employeeId: {
                    direction: 'shop',
                    period,
                    employeeId,
                },
            },
            select: { status: true },
        });
        return record?.status ?? null;
    }

    async deleteByPeriod(period: string): Promise<void> {
        await this.write(null, (client) =>
            client.salaryAccrual.deleteMany({
                where: { direction: 'shop', period },
            }),
        );
    }

    async findAccruedByEmployee(
        employeeId: number,
    ): Promise<ShopSalaryAccrual[]> {
        const records = await this.client.salaryAccrual.findMany({
            where: { direction: 'shop', employeeId, status: 'ACCRUED' },
            include: { lines: { include: { adjustments: true } } },
            orderBy: { period: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findPaidByEmployee(employeeId: number): Promise<ShopSalaryAccrual[]> {
        const records = await this.client.salaryAccrual.findMany({
            where: { direction: 'shop', employeeId, status: 'PAID' },
            include: { lines: { include: { adjustments: true } } },
            orderBy: { period: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
