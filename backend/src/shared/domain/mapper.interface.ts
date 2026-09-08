// DomainEntity намеренно не ограничен `extends Entity<any>` — интерфейсу это
// не нужно (toDomain/toPersistence не используют методы Entity), а некоторые
// доменные типы (например SalaryRule — union из calculate()-сущностей) сами
// по себе не являются подклассом Entity, хоть их конкретные реализации и есть.
export interface Mapper<
    DomainEntity,
    DbRecord,
    // Response = any,
> {
    toPersistence(entity: DomainEntity): DbRecord;
    toDomain(record: any): DomainEntity;
    // toResponse(entity: DomainEntity): Response;
}
