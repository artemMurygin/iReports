import { DateRange } from '@/shared/domain/date-range.value-object';
import { ServiceSaleEntity } from '../../domain/entities/service-sale.entity';
import { ServiceCategory } from '../../domain/value-objects/service-category.value-object';
import { OrderType } from '../../domain/value-objects/order-type.value-object';

// Фильтр строк "услуга × заказ" (GET /v1/service/reports/services, Фаза 5)
// — тот же набор, что у легаси getServicesSoldReportDTO (src/TODO/reports/
// dto/getServicesSoldReport.dto.ts): диапазон дат закрытия заказа +
// категории/услуги.
// spec: service/reports#requirement-отчёт-по-проданным-услугам-можно-ограничить-категориями-и-конкретными-услугами
export interface ServiceSalesFilter {
    range: DateRange;
    categoryIds: number[];
    serviceIds: number[];
}

// Единый порт на обе Prisma-таблицы, которые не переносятся в modules/sales
// (roapp_service_orders, roapp_service_categories) — см. PRD ("Порт
// SERVICE_SALES_SOURCE + Prisma-реализация поверх roappServiceOrder/
// roappServiceCategory"): один Prisma-репозиторий читает обе, отдельного
// порта под справочник категорий не заводится, т.к. у него нет собственных
// фильтров/инвариантов сверх самого чтения.
export interface ServiceSalesSourcePort {
    findByFilter(filter: ServiceSalesFilter): Promise<ServiceSaleEntity[]>;
    listCategories(): Promise<ServiceCategory[]>;
    listOrderTypes(): Promise<OrderType[]>;
}

export const SERVICE_SALES_SOURCE = Symbol('SERVICE_SALES_SOURCE');
