// Зеркало domains/service/modules/accounting/domain/services/
// accounting-cache-freshness.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop.
//
// Структурный, а не конкретный тип: ShopMotivationSchema имеет ту же форму
// getProps() (updatedAt + rules[].updatedAt), но не импортируется отсюда —
// domains/service и domains/shop не переиспользуют доменный код друг друга
// (см. backend/CLAUDE.md).
interface MotivationSchemaLike {
    getProps(): {
        updatedAt: Date;
        rules: { updatedAt: Date }[];
    };
}

// Ленивый кэш расчёта зарплаты по ключу (период, сотрудник, версия
// мотивационной схемы) + сравнение штампа последней успешной синхронизации
// домена. Инвалидация обязана срабатывать на ТРИ события: завершение
// синхронизации ERP, правку схемы/правила, правку или утверждение плана
// продаж — все три сворачиваются в одну строку сравнения, вычисляемую
// заново при каждом чтении отчёта (см. зеркальный файл сервиса за полным
// обоснованием этого приёма).
export function motivationSchemaVersion(
    schema: MotivationSchemaLike | null,
): string {
    if (!schema) {
        return 'none';
    }
    const props = schema.getProps();
    const timestamps = [
        props.updatedAt,
        ...props.rules.map((rule) => rule.updatedAt),
    ];
    const latest = timestamps.reduce(
        (max, ts) => (ts > max ? ts : max),
        new Date(0),
    );
    return latest.toISOString();
}

// Версия ПАРЫ схем, из которых собирается набор правил сотрудника — его
// личной и схемы его отдела (см. mergeEmployeeSalaryRules). Обе версии
// склеиваются в фиксированном порядке, а не сворачиваются в максимум —
// иначе удаление той из двух схем, чей updatedAt меньше, осталось бы
// незамеченным. 'none' на обе позиции (сотрудник без единой схемы)
// схлопнуты в одиночное 'none'.
export function motivationSchemasVersion(
    schemas: (MotivationSchemaLike | null)[],
): string {
    if (schemas.every((schema) => !schema)) {
        return 'none';
    }
    return schemas.map((schema) => motivationSchemaVersion(schema)).join('+');
}

export function stampOf(at: Date | null): string {
    return at ? at.toISOString() : 'never';
}

export function buildFreshnessStamp(parts: {
    motivationSchemaVersion: string;
    domainSyncStamp: string;
    salesPlanStamp: string;
}): string {
    return [
        parts.motivationSchemaVersion,
        parts.domainSyncStamp,
        parts.salesPlanStamp,
    ].join('|');
}
