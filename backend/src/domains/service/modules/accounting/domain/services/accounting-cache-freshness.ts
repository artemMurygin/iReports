import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';

// Ленивый кэш расчёта зарплаты (Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md) описан в PRD как ключ
// (направление, период, сотрудник, версия мотивационной схемы) +
// сравнение штампа последней успешной синхронизации домена. На практике
// инвалидация обязана срабатывать на ТРИ события (см. "Технические
// ограничения" PRD): завершение синхронизации, правку схемы/правила, правку
// или утверждение плана продаж. Три события — три независимых источника
// свежести, поэтому вместо явной подписки на доменные события (что
// потребовало бы делать SalesPlan агрегатом ради одного этого кросс-
// модульного эффекта — SalesPlan сейчас Entity, не AggregateRoot) все три
// сворачиваются в одну строку сравнения, вычисляемую заново при каждом
// чтении отчёта:
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
export function motivationSchemaVersion(
    schema: MotivationSchema | null,
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
