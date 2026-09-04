import type { SalaryAccrualStatus } from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual-line.entity';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';

// In-memory реализация SalaryAccrualRepositoryPort для юнит- и e2e-тестов
// закрытия/переоткрытия периода (тот же приём, что и фейки портов в
// get-employee-salary-report.e2e.spec.ts). markStatus — тестовый рычаг
// «документ уже проведён» (PRD 2 появится позже, а проверка reopen → 409
// нужна уже в PRD 1).
//
// Чтение отдаёт КОПИИ агрегата (см. clone) — как Prisma-реализация, которая
// на каждый findById собирает свежую сущность из записей БД. Без этого
// мутация агрегата хендлером (accrueLine до транзакции) «переживала» бы
// откат несостоявшегося save — и тест инъекции ошибки массового проведения
// (Фаза 7) видел бы состояние, невозможное с настоящей БД.
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
        return Promise.resolve(
            this.cloned(this.withStatus(this.store.get(id))) ?? null,
        );
    }

    findByIds(ids: string[]): Promise<SalaryAccrual[]> {
        return Promise.resolve(
            ids
                .map((id) => this.cloned(this.withStatus(this.store.get(id))))
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
                .map((accrual) => this.cloned(this.withStatus(accrual))!),
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

    findAccruedByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<SalaryAccrual[]> {
        return Promise.resolve(
            Array.from(this.store.values())
                .filter(
                    (accrual) =>
                        accrual.direction === direction &&
                        accrual.employeeId === employeeId &&
                        this.withStatus(accrual)!.status === 'ACCRUED',
                )
                .map((accrual) => this.cloned(this.withStatus(accrual))!),
        );
    }

    findPaidByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<SalaryAccrual[]> {
        return Promise.resolve(
            Array.from(this.store.values())
                .filter(
                    (accrual) =>
                        accrual.direction === direction &&
                        accrual.employeeId === employeeId &&
                        this.withStatus(accrual)!.status === 'PAID',
                )
                .map((accrual) => this.cloned(this.withStatus(accrual))!),
        );
    }

    markStatus(id: string, status: SalaryAccrualStatus): void {
        this.statusOverrides.set(id, status);
    }

    // Свежая копия агрегата на каждое чтение — эмуляция «Prisma собирает
    // сущность из записей БД заново»: мутации непроведённого save не видны
    // следующему читателю (см. комментарий в шапке класса).
    private cloned(
        accrual: SalaryAccrual | undefined,
    ): SalaryAccrual | undefined {
        if (!accrual) {
            return undefined;
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
                status: props.status,
                isDismissed: props.isDismissed,
                total: props.total,
                lines: props.lines.map((line) => {
                    const lineProps = line.getProps();
                    return new SalaryAccrualLine({
                        id: line.id,
                        createdAt: lineProps.createdAt,
                        updatedAt: lineProps.updatedAt,
                        props: {
                            position: lineProps.position,
                            ruleId: lineProps.ruleId,
                            type: lineProps.type,
                            name: lineProps.name,
                            targetRole: lineProps.targetRole,
                            salaryBasis: lineProps.salaryBasis,
                            quantity: lineProps.quantity,
                            rate: lineProps.rate,
                            originalAmount: lineProps.originalAmount,
                            amount: lineProps.amount,
                            sources: [...lineProps.sources],
                            status: lineProps.status,
                            adjustments: [...lineProps.adjustments],
                        },
                    });
                }),
            },
        });
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
