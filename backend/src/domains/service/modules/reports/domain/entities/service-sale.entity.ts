import { Entity, AggregateID } from '@/shared/domain/entity.base';

// Read-модель одной строки "услуга × заказ" (GET /v1/service/reports/services,
// Фаза 5, см. docs/todo-modules-ddd-refactoring) — перенос ServiceOrderRow из
// src/TODO/reports/reports.service.ts (тот же набор полей, объединяющий
// RoappServiceOrder со связанными RoappService/RoappOrder). Плоская проекция
// для аналитики, не агрегат: нет ни инвариантов, ни доменных событий, запись
// в БД никогда не идёт через эту read-модель (аналог DealListItemEntity в
// modules/sales).
//
// engineerSalary — переименование RoappServiceOrder.engeneerSalary
// (опечатка в названии Prisma-поля/колонки БД, унаследованная от RemOnline
// API) на корректное написание для доменного слоя — тот же приём, что и у
// catalogEngineerBonus в domains/service/modules/accounting/domain/types/
// service-calculation-data.types.ts для похожего поля RoappService.engeneerBonus.
export type ServiceSaleProps = {
    serviceId: number;
    serviceName: string;
    categoryId: number | null;
    orderId: number;
    quantity: number;
    price: number;
    engineerSalary: number;
    closedAt: Date;
    orderPayed: number;
    orderCost: number;
};

export class ServiceSaleEntity extends Entity<ServiceSaleProps> {
    declare protected _id: AggregateID;

    validate(): void {}
}
