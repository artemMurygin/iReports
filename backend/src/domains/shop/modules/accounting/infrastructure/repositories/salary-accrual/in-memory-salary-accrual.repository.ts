import type { SalaryAccrualStatus } from 'ireports-contracts';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { ShopSalaryAccrualLine } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual-line.entity';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// salary-accrual/in-memory-salary-accrual.repository.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop (без параметра direction — он
// зафиксирован тем, что все документы этого стора уже направления shop).
// Чтение отдаёт КОПИИ агрегата (см. clone) — как Prisma-реализация, которая
// на каждый findById собирает свежую сущность из записей БД.
export class InMemoryShopSalaryAccrualRepository implements ShopSalaryAccrualRepositoryPort {
    readonly store = new Map<string, ShopSalaryAccrual>();
    private readonly statusOverrides = new Map<string, SalaryAccrualStatus>();

    saveAll(period: string, accruals: ShopSalaryAccrual[]): Promise<void> {
        for (const [id, existing] of this.store) {
            if (existing.period === period) {
                this.store.delete(id);
            }
        }
        for (const accrual of accruals) {
            this.store.set(accrual.id, accrual);
        }
        return Promise.resolve();
    }

    findById(id: string): Promise<ShopSalaryAccrual | null> {
        return Promise.resolve(
            this.cloned(this.withStatus(this.store.get(id))) ?? null,
        );
    }

    findByIds(ids: string[]): Promise<ShopSalaryAccrual[]> {
        return Promise.resolve(
            ids
                .map((id) => this.cloned(this.withStatus(this.store.get(id))))
                .filter((accrual): accrual is ShopSalaryAccrual =>
                    Boolean(accrual),
                ),
        );
    }

    save(accrual: ShopSalaryAccrual): Promise<void> {
        this.store.set(accrual.id, accrual);
        return Promise.resolve();
    }

    findByPeriod(period: string): Promise<ShopSalaryAccrual[]> {
        return Promise.resolve(
            Array.from(this.store.values())
                .filter((accrual) => accrual.period === period)
                .map((accrual) => this.cloned(this.withStatus(accrual))!),
        );
    }

    findStatusByKey(
        period: string,
        employeeId: number,
    ): Promise<SalaryAccrualStatus | null> {
        const found = Array.from(this.store.values()).find(
            (accrual) =>
                accrual.period === period && accrual.employeeId === employeeId,
        );
        return Promise.resolve(found ? this.withStatus(found)!.status : null);
    }

    deleteByPeriod(period: string): Promise<void> {
        for (const [id, existing] of this.store) {
            if (existing.period === period) {
                this.store.delete(id);
                this.statusOverrides.delete(id);
            }
        }
        return Promise.resolve();
    }

    findAccruedByEmployee(employeeId: number): Promise<ShopSalaryAccrual[]> {
        return Promise.resolve(
            Array.from(this.store.values())
                .filter(
                    (accrual) =>
                        accrual.employeeId === employeeId &&
                        this.withStatus(accrual)!.status === 'ACCRUED',
                )
                .map((accrual) => this.cloned(this.withStatus(accrual))!),
        );
    }

    findPaidByEmployee(employeeId: number): Promise<ShopSalaryAccrual[]> {
        return Promise.resolve(
            Array.from(this.store.values())
                .filter(
                    (accrual) =>
                        accrual.employeeId === employeeId &&
                        this.withStatus(accrual)!.status === 'PAID',
                )
                .map((accrual) => this.cloned(this.withStatus(accrual))!),
        );
    }

    markStatus(id: string, status: SalaryAccrualStatus): void {
        this.statusOverrides.set(id, status);
    }

    private cloned(
        accrual: ShopSalaryAccrual | undefined,
    ): ShopSalaryAccrual | undefined {
        if (!accrual) {
            return undefined;
        }
        const props = accrual.getProps();
        return new ShopSalaryAccrual({
            id: accrual.id,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            props: {
                period: props.period,
                employeeId: props.employeeId,
                status: props.status,
                isDismissed: props.isDismissed,
                total: props.total,
                lines: props.lines.map((line) => {
                    const lineProps = line.getProps();
                    return new ShopSalaryAccrualLine({
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

    private withStatus(
        accrual: ShopSalaryAccrual | undefined,
    ): ShopSalaryAccrual | undefined {
        if (!accrual) {
            return undefined;
        }
        const status = this.statusOverrides.get(accrual.id);
        if (!status) {
            return accrual;
        }
        const props = accrual.getProps();
        return new ShopSalaryAccrual({
            id: accrual.id,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            props: {
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
