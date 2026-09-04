// Структурный, а не конкретный тип: домен shop заводит собственную (не
// импортируемую отсюда, см. backend/CLAUDE.md о независимости деревьев
// modules/accounting service/shop) мотивационную схему с такой же формой
// getProps() — Фаза 13.5, docs/payroll/phase-13.5-shop-report-integration.md.
interface MotivationSchemaLike {
    getProps(): {
        updatedAt: Date;
        rules: { updatedAt: Date }[];
    };
}

// spec: service/accounting#requirement-открытый-период-пересчитывается-по-актуальным-данным
//
// Собирает freshness-штамп ленивого кэша расчёта зарплаты (Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md). Вместо явной подписки на доменные события (что
// потребовало бы делать SalesPlan агрегатом ради одного этого кросс-модульного эффекта — SalesPlan
// сейчас Entity, не AggregateRoot) все три источника свежести сворачиваются в одну строку сравнения
// (см. buildStamp), вычисляемую заново при каждом чтении отчёта:
//
// - версия мотивационной схемы — не отдельное поле в БД, а
//   max(schema.updatedAt, ...rules.map(r => r.updatedAt)): Prisma сама
//   бьёт updatedAt при любом update(), а правка правила/схемы неизбежно
//   идёт через update() соответствующей строки;
// - штамп синхронизации — DomainSyncStatus.lastSuccessfulSyncAt направления;
// - штамп плана — max(updatedAt) среди строк SalesPlan периода/направления
//   (SalesPlan.edit()/.approve() оба идут через update(), см.
//   SalesPlanRepository.update()).
//
// Совпадение итоговой строки с сохранённой в AccountingCalculationCache —
// кэш отдаётся как есть; расхождение — пересчёт с перезаписью той же строки
// (см. PRD: "кэш отдаётся, если штамп и версия схемы совпадают ... иначе —
// пересчёт с перезаписью").
//
// Методы сгруппированы в класс, а не разбросаны как одноимённые (с точностью
// до множественного числа) экспорты функций — schemaVersion/schemaPairVersion
// на глаз слишком легко перепутать местами.
export class AccountingCacheFreshness {
    // Версия ОДНОЙ мотивационной схемы: max(schema.updatedAt,
    // ...rules[].updatedAt). 'none', если схемы нет.
    static schemaVersion(schema: MotivationSchemaLike | null): string {
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
    // склеиваются в фиксированном порядке, а не сворачиваются в максимум:
    // максимум не заметил бы удаления той из двух схем, чей updatedAt меньше,
    // — сотрудник продолжил бы считаться по кэшу с уже несуществующими
    // правилами. 'none' на обе позиции (сотрудник без единой схемы) схлопнут в
    // одиночное 'none' — так строка совпадает с прежним форматом там, где схем
    // нет вовсе.
    static schemaPairVersion(schemas: (MotivationSchemaLike | null)[]): string {
        if (schemas.every((schema) => !schema)) {
            return 'none';
        }
        return schemas
            .map((schema) => AccountingCacheFreshness.schemaVersion(schema))
            .join('+');
    }

    // Date | null → строка штампа (ISO либо 'never'). Используется и для
    // штампа синхронизации ERP, и для штампа последнего изменения плана
    // продаж — назначение поля видно из места вызова, а не из имени метода.
    static dateStamp(at: Date | null): string {
        return at ? at.toISOString() : 'never';
    }

    // Склеивает три источника инвалидации кэша в одну строку сравнения.
    static buildStamp(parts: {
        schemaVersion: string;
        domainSyncStamp: string;
        salesPlanStamp: string;
    }): string {
        return [
            parts.schemaVersion,
            parts.domainSyncStamp,
            parts.salesPlanStamp,
        ].join('|');
    }
}
