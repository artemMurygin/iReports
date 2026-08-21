import type { SalaryAccrualStatus } from 'ireports-contracts';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Документы начисления зарплаты (PRD 1 docs/payroll-closing-and-accrual) —
// порт direction-агностичен, как и AccountingPeriodSnapshotPort: направление
// — часть естественного ключа (direction, period, employeeId), а не ветка
// поведения. Оба домена (AccountingModule сервиса и ShopAccountingModule)
// заводят собственные экземпляры одной Prisma-реализации под этим же
// токеном — тот же приём, что и у остальных портов расчётного периода.
export interface SalaryAccrualRepositoryPort {
    // Запись документов закрытия — в транзакции UnitOfWork вместе со
    // снапшотом и переводом периода в CLOSED (см. CloseAccountingPeriodHandler).
    // Полностью заменяет документы периода/направления, если они почему-то
    // уже есть (тот же контракт, что у AccountingPeriodSnapshotPort.saveAll).
    saveAll(
        direction: AccountingDirection,
        period: string,
        accruals: SalaryAccrual[],
    ): Promise<void>;

    // Карточка документа (GET .../salary_accruals/:id) — со строками.
    findById(id: string): Promise<SalaryAccrual | null>;

    // Список документов за период (GET .../salary_accruals?period) — со
    // строками: список отдаёт только их число (linesCount), но отдельный
    // «лёгкий» метод не нужен, пока документов в месяце — десятки.
    findByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<SalaryAccrual[]>;

    // Статус документа сотрудника для зарплатного отчёта закрытого периода
    // (PRD 1: "ожидает начисление / начислено / выплачено"); null — документа
    // нет (сотрудник не попал в снапшот).
    findStatusByKey(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<SalaryAccrualStatus | null>;

    // Удаление документов периода при повторном открытии — только после
    // проверки, что все они DRAFT (ReopenAccountingPeriodHandler).
    deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void>;
}

export const SALARY_ACCRUAL_REPOSITORY = Symbol('SALARY_ACCRUAL_REPOSITORY');
