import type { BalanceTransactionType } from 'ireports-contracts';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Фильтры ленты движений (GET .../balance/employee/:id?from&to&types):
// диапазон — по дате движения occurredAt (не по дате создания записи).
export interface BalanceTransactionFilter {
    from?: Date;
    to?: Date;
    types?: BalanceTransactionType[];
}

// Лента движений баланса сотрудника (PRD 2 docs/payroll-closing-and-accrual)
// — порт direction-агностичен, как SalaryAccrualRepositoryPort: направление
// — часть ключа баланса (employeeId, direction), а не ветка поведения. Оба
// домена (AccountingModule сервиса и ShopAccountingModule) заводят
// собственные экземпляры одной Prisma-реализации под этим же токеном.
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
    // ACCRUAL_ADJUSTMENT строки (единственное исключение из неизменяемости
    // ленты — см. BalanceTransaction). Другие типы движений этим методом
    // не задеваются.
    deleteAccrualTransactionsByLineId(lineId: string): Promise<void>;

    // Лента с фильтрами — по убыванию даты движения.
    findByEmployee(
        direction: AccountingDirection,
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransaction[]>;

    // Остаток = SUM(amount) всей ленты пары (employeeId, direction) —
    // хранимого поля «остаток» нет (PRD 2, «Технические ограничения»).
    sumByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<number>;

    // Ид сторнированных движений из перечня: движение сторнировано, если на
    // него ссылается MANUAL_REVERSAL (reversedTransactionId). В Фазе 6
    // сторно ещё не создаётся (Фаза 7), но признак isReversed в ответе
    // вычисляется честно уже сейчас.
    findReversedIds(transactionIds: string[]): Promise<Set<string>>;

    // Исходное движение для сторно (Фаза 7): null — не найдено. Повторная
    // вставка сторно того же движения обязана бросить
    // BalanceTransactionAlreadyReversedException (уникальное ограничение
    // reversedTransactionId, реализация мапит P2002) — гонка параллельных
    // reverse не создаёт второго MANUAL_REVERSAL.
    findById(id: string): Promise<BalanceTransaction | null>;

    // Остатки набора сотрудников для сводки отдела (Фаза 7) — один запрос
    // groupBy на весь отдел, а не sumByEmployee в цикле (нет N+1);
    // сотрудник без движений в карте отсутствует (остаток 0).
    sumByEmployees(
        direction: AccountingDirection,
        employeeIds: number[],
    ): Promise<Map<number, number>>;

    // Движения сотрудников отдела, относящиеся к месяцу сводки (Фаза 7):
    // датированные месяцем (occurredAt в [monthStart, monthEnd]) ИЛИ
    // движения начисления запрошенного периода (period — у них occurredAt
    // — момент проведения, который может быть в другом месяце).
    // Классификацию по колонкам (начислено/авансы/ручные) делает сервис.
    findForDepartmentSummary(
        direction: AccountingDirection,
        employeeIds: number[],
        period: string,
        monthStart: Date,
        monthEnd: Date,
    ): Promise<BalanceTransaction[]>;
}

export const BALANCE_TRANSACTION_REPOSITORY = Symbol(
    'BALANCE_TRANSACTION_REPOSITORY',
);
