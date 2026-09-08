import { RuleBreakdownLine } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';

export interface ShopAccountingPeriodSnapshotRow {
    employeeId: number;
    total: number;
    lines: RuleBreakdownLine[];
}

// Зеркало domains/service/modules/accounting/application/ports/
// accounting-period-snapshot.port.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимый порт для
// направления shop, без параметра direction. Неизменяемый снапшот сумм по
// каждому сотруднику за закрытый период — создаётся один раз при закрытии,
// отдаётся вместо расчёта всё время, пока период CLOSED, и удаляется
// целиком при повторном открытии.
export interface ShopAccountingPeriodSnapshotPort {
    // periodId — id агрегата ShopAccountingPeriod, которому принадлежит
    // снапшот (FK в БД, см. accounting-period.prisma); saveAll полностью
    // заменяет существующие строки периода, если они почему-то уже есть
    // (повторное закрытие после реоткрытия).
    saveAll(
        periodId: string,
        period: string,
        rows: ShopAccountingPeriodSnapshotRow[],
    ): Promise<void>;

    findByKey(
        period: string,
        employeeId: number,
    ): Promise<ShopAccountingPeriodSnapshotRow | null>;

    // Батч-версия findByKey для отчёта по отделу за закрытый период — один
    // запрос на весь отдел вместо одного на сотрудника. Сотрудники без
    // строки снапшота просто отсутствуют в результирующей Map.
    findManyByKey(
        period: string,
        employeeIds: number[],
    ): Promise<Map<number, ShopAccountingPeriodSnapshotRow>>;

    deleteByPeriod(period: string): Promise<void>;
}

export const SHOP_ACCOUNTING_PERIOD_SNAPSHOT = Symbol(
    'SHOP_ACCOUNTING_PERIOD_SNAPSHOT',
);
