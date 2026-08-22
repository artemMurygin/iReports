import type { BalanceTransactionType } from 'ireports-contracts';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// Фильтры ленты движений (GET /v1/accounting/balance/employee/:id?from&to&types):
// диапазон — по дате движения occurredAt (не по дате создания записи).
export interface BalanceTransactionFilter {
    from?: Date;
    to?: Date;
    types?: BalanceTransactionType[];
}

// Лента движений баланса сотрудника (PRD 2 docs/payroll-closing-and-accrual)
// — баланс ОБЩИЙ по сотруднику (Фаза 8b): все выборки и агрегаты — по
// employeeId, без направления; direction движения — лишь атрибут
// происхождения, хранящийся в данных. Порт живёт в accounting сервиса, но
// direction-агностичен, как SalaryAccrualRepositoryPort; проведение
// начисления из любого домена пишет в одну и ту же ленту.
export interface BalanceTransactionRepositoryPort {
    // Запись движений проведения строки — в транзакции UnitOfWork вместе с
    // сохранением статусов строки/документа (AccrueSalaryAccrualLineHandler).
    // Уникальный индекс (lineId, type) в БД — идемпотентность проведения:
    // повторная вставка движения той же строки обязана бросить
    // SalaryAccrualLineAlreadyAccruedException (реализация мапит P2002), а
    // не молча создать дубль — это тот же конфликт «строка уже проведена»,
    // что и на прямом повторе, только пойманный на гонке параллельных
    // запросов уровнем БД.
    insertMany(transactions: BalanceTransaction[]): Promise<void>;

    // Отмена начисления: удаление движений SALARY_ACCRUAL и
    // ACCRUAL_ADJUSTMENT строки. Другие типы движений этим методом не
    // задеваются.
    deleteAccrualTransactionsByLineId(lineId: string): Promise<void>;

    // Прямое удаление ошибочного ручного движения (Фаза 8b): запись
    // исчезает из ленты, остаток пересчитывается сам собой (он — SUM).
    // Проверка «можно ли удалять» — ответственность домена/хендлера
    // (BalanceTransaction.ensureDeletable), не репозитория.
    deleteById(id: string): Promise<void>;

    // Лента с фильтрами — по убыванию даты движения.
    findByEmployee(
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransaction[]>;

    // Остаток = SUM(amount) всей ленты сотрудника независимо от направления
    // движений — хранимого поля «остаток» нет (PRD 2, «Технические
    // ограничения»).
    sumByEmployee(employeeId: number): Promise<number>;

    // Движение по id: null — не найдено (удаление, Фаза 8b).
    findById(id: string): Promise<BalanceTransaction | null>;

    // Остатки набора сотрудников для сводки отдела (Фаза 7) — один запрос
    // groupBy на весь отдел, а не sumByEmployee в цикле (нет N+1);
    // сотрудник без движений в карте отсутствует (остаток 0).
    sumByEmployees(employeeIds: number[]): Promise<Map<number, number>>;

    // Движения сотрудников отдела, относящиеся к месяцу сводки (Фаза 7):
    // датированные месяцем (occurredAt в [monthStart, monthEnd]) ИЛИ
    // движения начисления запрошенного периода (period — у них occurredAt
    // — момент проведения, который может быть в другом месяце).
    // Классификацию по колонкам (начислено/авансы/ручные) делает сервис.
    findForDepartmentSummary(
        employeeIds: number[],
        period: string,
        monthStart: Date,
        monthEnd: Date,
    ): Promise<BalanceTransaction[]>;
}

export const BALANCE_TRANSACTION_REPOSITORY = Symbol(
    'BALANCE_TRANSACTION_REPOSITORY',
);
