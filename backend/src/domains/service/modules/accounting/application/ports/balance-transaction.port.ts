import type { BalanceTransactionType } from 'ireports-contracts';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// Фильтры ленты движений (GET /v1/accounting/balance/employee/:id?from&to&types
// &cursor&limit): диапазон — по дате движения occurredAt (не по дате
// создания записи). cursor/limit (Фаза 7 docs/employee-settlements-page-
// redesign) — курсорная пагинация «за всё время»: from/to по-прежнему
// НЕОБЯЗАТЕЛЬНЫ (их отсутствие уже означало «за всё время» до Фазы 7 — сама
// пагинация ничего не меняет в этой семантике, только режет результат на
// страницы). cursor — id последнего движения предыдущей страницы; limit —
// без значения из query используется DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT
// (см. ниже) — контракт (getEmployeeBalanceQuerySchema) валидирует только
// верхнюю границу (400 при limit > MAX), дефолт — ответственность бэкенда,
// не схемы (см. WHY в contracts/commands/employee-balance.ts).
export interface BalanceTransactionFilter {
    from?: Date;
    to?: Date;
    types?: BalanceTransactionType[];
    cursor?: string;
    limit?: number;
}

// sumFilteredByEmployee (Фаза 7) применяет тот же where, что findByEmployee,
// но БЕЗ cursor/limit — сознательно урезанный тип, а не тот же
// BalanceTransactionFilter целиком: вызывающий код не должен иметь
// возможность передать сюда пагинацию, которая для агрегата по ВСЕЙ
// отфильтрованной выборке не имеет смысла (см. WHY у самого метода порта).
export type BalanceTransactionDateTypeFilter = Pick<
    BalanceTransactionFilter,
    'from' | 'to' | 'types'
>;

// Страница ленты (Фаза 7): items — записи текущей страницы (уже
// отсортированные, см. WHY на findByEmployee), nextCursor — id последней
// записи страницы для следующего запроса (null — страница последняя),
// hasMore — есть ли ещё более ранние записи после этой страницы.
export interface BalanceTransactionPage {
    items: BalanceTransaction[];
    nextCursor: string | null;
    hasMore: boolean;
}

// Дефолт и потолок размера страницы (Фаза 7, PRD «изначально последние 20
// движений, далее — подгрузка следующих 20»). Верхняя граница дублируется в
// getEmployeeBalanceQuerySchema (.max(100)) как защита на границе HTTP
// (400 вместо тихого урезания) — здесь та же цифра для дефолта, когда limit
// вовсе не передан.
export const DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT = 20;
export const MAX_BALANCE_TRANSACTIONS_PAGE_LIMIT = 100;

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

    // Страница ленты с фильтрами (Фаза 7) — сортировка по убыванию: дата
    // движения (occurredAt), затем дата создания записи (createdAt), затем
    // id — тройной ключ, а не только occurredAt/createdAt: у двух движений
    // одного проведения (SALARY_ACCRUAL + ACCRUAL_ADJUSTMENT, см.
    // BalanceTransaction.forAccruedLine) occurredAt общий (один вызов
    // new Date() на оба), а createdAt у каждого — свой отдельный вызов
    // Entity-конструктора, который технически может совпасть до
    // миллисекунды — без id порядок такой пары (и порядок строк одной
    // страницы между двумя запросами) был бы недетерминирован. limit/cursor
    // — из filter (см. WHY на BalanceTransactionFilter выше).
    findByEmployee(
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransactionPage>;

    // Остаток = SUM(amount) всей ленты сотрудника независимо от направления
    // движений — хранимого поля «остаток» нет (PRD 2, «Технические
    // ограничения»).
    sumByEmployee(employeeId: number): Promise<number>;

    // Сумма ВСЕЙ отфильтрованной выборки (Фаза 7) — тот же where, что
    // findByEmployee (from/to/types), но БЕЗ пагинации: selectionTotal в
    // ответе баланса обязан отражать сумму по фильтру целиком, а не только
    // текущей загруженной страницы (findByEmployee теперь режет результат
    // на страницы, поэтому суммировать её массив, как раньше, — ошибка).
    sumFilteredByEmployee(
        employeeId: number,
        filter: BalanceTransactionDateTypeFilter,
    ): Promise<number>;

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

    // Дата последнего движения по каждому сотруднику набора (сквозной
    // список взаиморасчётов, docs/employee-settlements-page-redesign,
    // Фаза 1) — max(occurredAt), один groupBy-запрос на всю выборку, как и
    // sumByEmployees выше (без N+1). Сотрудник без движений в карте
    // отсутствует (дата — null на уровне сервиса).
    findLastMovementDateByEmployees(
        employeeIds: number[],
    ): Promise<Map<number, Date>>;
}

export const BALANCE_TRANSACTION_REPOSITORY = Symbol(
    'BALANCE_TRANSACTION_REPOSITORY',
);
