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

    // Раскрытие движений начисления в ленте баланса до строк документов
    // (GET .../balance/employee/:id): один запрос на все accrualId выборки,
    // а не по движению (нет N+1).
    findByIds(ids: string[]): Promise<SalaryAccrual[]>;

    // Сохранение переходов PRD 2 (проведение/отмена/корректировка строки):
    // статус документа, статус/действующая сумма строк и новые записи
    // истории корректировок. Вызывается в транзакции UnitOfWork вместе с
    // записью/удалением движений баланса (см. AccrueSalaryAccrualLineHandler).
    save(accrual: SalaryAccrual): Promise<void>;

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

    // Выплата (PRD 3 docs/payroll-closing-and-accrual/
    // prd-salary-payout-and-erp-cash-documents.md, Фаза 12): документы
    // сотрудника направления в статусе ACCRUED — именно те, что кандидаты на
    // переход в PAID, когда остаток после операции ≤ 0 (см.
    // SalaryAccrual.markPaid). Не ограничен периодом намеренно — выплата не
    // привязана к одному месяцу (руководитель может закрывать остаток,
    // накопленный за несколько периодов, одной выплатой), поэтому
    // обработчик выплаты обязан пройтись по ВСЕМ ACCRUED-документам
    // сотрудника этого направления, а не только за период операции.
    // Обработчик удаления выплаты решает симметричную задачу (найти
    // документы, которые нужно вернуть из PAID в ACCRUED, см.
    // SalaryAccrual.revertToAccrued) другим путём — через
    // findByIds/сохранённые accrualId движений, отменяемых удалением
    // выплаты, а не через этот метод (у него нет своего findPaidByEmployee:
    // документы, которые выплата перевела в PAID, уже известны по своим id).
    findAccruedByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<SalaryAccrual[]>;

    // Удаление выплаты (PRD 3, Фаза 12, docs/payroll-closing-and-accrual/
    // prd-salary-payout-and-erp-cash-documents.md, «возврат документов
    // начисления из PAID в ACCRUED»): документы сотрудника направления в
    // статусе PAID — кандидаты на revertToAccrued(). РЕШЕНИЕ (см. отчёт
    // Фазы 12, вопрос "как определить затронутые документы"): движение
    // PAYOUT не хранит accrualId (см. BalanceTransaction.forPayout — оно
    // может закрывать остаток, накопленный сразу несколькими документами,
    // см. markPaid), поэтому здесь нет точной обратной связи "эта конкретная
    // выплата перевела в PAID именно эти документы". Обработчик удаления
    // выплаты трактует "затронутые" максимально просто — ВСЕ PAID-документы
    // сотрудника этого направления, раз PAID проставлялся пакетно тем же
    // критерием (общий остаток ≤ 0). Задокументированная граница: если
    // остаток сотрудника закрывался НЕСКОЛЬКИМИ операциями подряд (например,
    // двумя выплатами), удаление одной из них вернёт в ACCRUED документы,
    // закрытые и другой, ещё не удалённой операцией — точный расчёт
    // потребовал бы отдельной связи "выплата → набор документов", что не
    // входит в эту фазу. Не period-скоуплен намеренно, тем же приёмом, что
    // findAccruedByEmployee выше.
    findPaidByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<SalaryAccrual[]>;
}

export const SALARY_ACCRUAL_REPOSITORY = Symbol('SALARY_ACCRUAL_REPOSITORY');
