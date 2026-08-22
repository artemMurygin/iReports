import type { SalaryAccrualStatus } from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';

// In-memory реализация SalaryAccrualRepositoryPort для юнит- и e2e-тестов
// закрытия/переоткрытия периода (тот же приём, что и фейки портов в
// get-employee-salary-report.e2e.spec.ts). Хранит сущности как есть;
// markStatus — тестовый рычаг «документ уже проведён» (PRD 2 появится
// позже, а проверка reopen → 409 нужна уже в PRD 1).
export class InMemorySalaryAccrualRepository implements SalaryAccrualRepositoryPort {
    readonly store = new Map<string, SalaryAccrual>();
    private readonly statusOverrides = new Map<string, SalaryAccrualStatus>();

    saveAll(
        direction: AccountingDirection,
        period: string,
        accruals: SalaryAccrual[],
    ): Promise<void> {
        for (const [id, existing] of this.store) {
            if (
                existing.direction === direction &&
                existing.period === period
            ) {
                this.store.delete(id);
            }
        }
        for (const accrual of accruals) {
            this.store.set(accrual.id, accrual);
        }
        return Promise.resolve();
    }

    findById(id: string): Promise<SalaryAccrual | null> {
        return Promise.resolve(this.withStatus(this.store.get(id)) ?? null);
    }

    findByIds(ids: string[]): Promise<SalaryAccrual[]> {
        return Promise.resolve(
            ids
                .map((id) => this.withStatus(this.store.get(id)))
                .filter((accrual): accrual is SalaryAccrual =>
                    Boolean(accrual),
                ),
        );
    }

    // Переходы PRD 2 (проведение/отмена/корректировка строки) — хранит
    // сущность как есть, вместе со статусами строк и историей корректировок.
    save(accrual: SalaryAccrual): Promise<void> {
        this.store.set(accrual.id, accrual);
        return Promise.resolve();
    }

    findByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<SalaryAccrual[]> {
        return Promise.resolve(
            Array.from(this.store.values())
                .filter(
                    (accrual) =>
                        accrual.direction === direction &&
                        accrual.period === period,
                )
                .map((accrual) => this.withStatus(accrual)!),
        );
    }

    findStatusByKey(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<SalaryAccrualStatus | null> {
        const found = Array.from(this.store.values()).find(
            (accrual) =>
                accrual.direction === direction &&
                accrual.period === period &&
                accrual.employeeId === employeeId,
        );
        return Promise.resolve(found ? this.withStatus(found)!.status : null);
    }

    deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void> {
        for (const [id, existing] of this.store) {
            if (
                existing.direction === direction &&
                existing.period === period
            ) {
                this.store.delete(id);
                this.statusOverrides.delete(id);
            }
        }
        return Promise.resolve();
    }

    markStatus(id: string, status: SalaryAccrualStatus): void {
        this.statusOverrides.set(id, status);
    }

    // Подмена статуса без мутации props сущности (у SalaryAccrual в PRD 1
    // нет переходов статуса) — пересобираем агрегат с тем же id/строками.
    private withStatus(
        accrual: SalaryAccrual | undefined,
    ): SalaryAccrual | undefined {
        if (!accrual) {
            return undefined;
        }
        const status = this.statusOverrides.get(accrual.id);
        if (!status) {
            return accrual;
        }
        const props = accrual.getProps();
        return new SalaryAccrual({
            id: accrual.id,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            props: {
                direction: props.direction,
                period: props.period,
                employeeId: props.employeeId,
                status,
                isDismissed: props.isDismissed,
                total: props.total,
                lines: props.lines,
            },
        });
    }
}
