import { Injectable } from '@nestjs/common';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SalaryAccrualMapper } from '../../mappers/salary-accrual/salary-accrual.mapper';

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
            include: { lines: { include: { adjustments: true } } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByIds(ids: string[]): Promise<SalaryAccrual[]> {
        if (ids.length === 0) {
            return [];
        }
        const records = await this.client.salaryAccrual.findMany({
            where: { id: { in: ids } },
            include: { lines: { include: { adjustments: true } } },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<SalaryAccrual[]> {
        // Без orderBy по employeeId (docs/employee-ordering-and-salary-filter,
        // Фаза 1): SalaryAccrual не связан с BitrixEmployee Prisma-relation'ом
        // (общая с shop таблица, employeeId — обычный Int, см. WHY в
        // backend/CLAUDE.md "Общие таблицы между service и shop"), поэтому
        // единый order сотрудника здесь не выразить через orderBy на
        // связанном поле. Единственный потребитель, которому важен порядок
        // строк (ListSalaryAccrualsService, ведомость начислений периода),
        // сортирует результат сам — по order уже загруженного им списка
        // сотрудников (см. WHY там); остальные потребители (закрытие
        // периода, сводка баланса и т.п.) порядок не используют.
        const records = await this.client.salaryAccrual.findMany({
            where: { direction, period },
            include: { lines: { include: { adjustments: true } } },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    // Сохранение переходов PRD 2 (проведение/отмена/корректировка): статус
    // документа, статус и действующая сумма строк, новые записи истории
    // корректировок (skipDuplicates — уже сохранённые записи с тем же id
    // пропускаются, корректировка неизменяема). Состав строк и originalAmount
    // после закрытия не меняются, поэтому строки не пересоздаются — только
    // update изменяемых полей.
    async save(accrual: SalaryAccrual): Promise<void> {
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

    // Выплата (PRD 3, Фаза 12) — см. WHY на портe (не ограничен периодом:
    // выплата может закрывать остаток, накопленный за несколько месяцев).
    async findAccruedByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<SalaryAccrual[]> {
        const records = await this.client.salaryAccrual.findMany({
            where: { direction, employeeId, status: 'ACCRUED' },
            include: { lines: { include: { adjustments: true } } },
            orderBy: { period: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    // Удаление выплаты (PRD 3, Фаза 12) — см. WHY на порте.
    async findPaidByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<SalaryAccrual[]> {
        const records = await this.client.salaryAccrual.findMany({
            where: { direction, employeeId, status: 'PAID' },
            include: { lines: { include: { adjustments: true } } },
            orderBy: { period: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
