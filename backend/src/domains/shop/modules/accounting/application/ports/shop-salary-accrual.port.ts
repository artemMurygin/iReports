import type { SalaryAccrualStatus } from 'ireports-contracts';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/shop-salary-accrual.entity';

// Зеркало domains/service/modules/accounting/application/ports/
// salary-accrual.port.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый порт для направления shop, без параметра direction: он
// зафиксирован реализацией (см. ShopSalaryAccrualRepository), тот же приём,
// что и у ShopAccountingPeriodRepositoryPort (Фаза 5).
export interface ShopSalaryAccrualRepositoryPort {
    // Запись документов закрытия — в транзакции UnitOfWork вместе со
    // снапшотом и переводом периода в CLOSED (см.
    // CloseShopAccountingPeriodHandler). Полностью заменяет документы
    // периода, если они почему-то уже есть.
    saveAll(period: string, accruals: ShopSalaryAccrual[]): Promise<void>;

    // Карточка документа (GET .../salary_accruals/:id) — со строками.
    findById(id: string): Promise<ShopSalaryAccrual | null>;

    // Раскрытие движений начисления в ленте баланса до строк документов.
    findByIds(ids: string[]): Promise<ShopSalaryAccrual[]>;

    // Сохранение переходов PRD 2 (проведение/отмена/корректировка строки).
    save(accrual: ShopSalaryAccrual): Promise<void>;

    // Список документов за период (GET .../salary_accruals?period).
    findByPeriod(period: string): Promise<ShopSalaryAccrual[]>;

    // Статус документа сотрудника для зарплатного отчёта закрытого периода.
    findStatusByKey(
        period: string,
        employeeId: number,
    ): Promise<SalaryAccrualStatus | null>;

    // Удаление документов периода при повторном открытии — только после
    // проверки, что все они DRAFT (ReopenShopAccountingPeriodHandler).
    deleteByPeriod(period: string): Promise<void>;

    // Выплата (PRD 3, Фаза 12) — документы сотрудника в статусе ACCRUED, не
    // ограничено периодом намеренно (тот же приём, что у сервисного порта).
    findAccruedByEmployee(employeeId: number): Promise<ShopSalaryAccrual[]>;

    // Удаление выплаты (PRD 3, Фаза 12) — документы сотрудника в статусе
    // PAID, не ограничено периодом.
    findPaidByEmployee(employeeId: number): Promise<ShopSalaryAccrual[]>;
}

export const SHOP_SALARY_ACCRUAL_REPOSITORY = Symbol(
    'SHOP_SALARY_ACCRUAL_REPOSITORY',
);
