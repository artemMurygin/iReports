import { z } from 'zod';
import { EmployeesShortSchema } from '../roapp/schemas/employees.schema';
import { OrderTypesSchema } from '../roapp/schemas/orderTypes.schema';
import { MarketingSourcesShortSchema } from '../roapp/schemas/marketingSources.schema';
import { OrderStatusesSchema } from '../roapp/schemas/orderStatuses.schema';
import { OrderSchema } from '../roapp/schemas/orders.schema';
import { OrderItemSchema } from '../roapp/schemas/orderItems.schema';
import { Category } from '../roapp/schemas/serviceCatalog.schema';
import { Service } from '../roapp/schemas/services.schema';
import { Product } from '../roapp/schemas/products.schema';
import { ServiceBonusForEngeneer } from '../custom-api-roapp/schemas/serviceBonusForEngeneer.schema';
import { ServiceBonusById } from '../custom-api-roapp/schemas/serviceBonusById.schema';
import {
    CreateServiceRequest,
    CreateServiceResponse,
} from '../custom-api-roapp/schemas/createService.schema';
import { UpdateServicesResponse } from '../custom-api-roapp/schemas/updateServices.schema';

export type EmployeeShort = z.infer<typeof EmployeesShortSchema>;
export type OrderType = z.infer<typeof OrderTypesSchema>;
export type MarketingSourceShort = z.infer<typeof MarketingSourcesShortSchema>;
export type OrderStatus = z.infer<typeof OrderStatusesSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = NonNullable<z.infer<typeof OrderItemSchema>>;

/**
 * Единая точка входа в данные RemOnline для домена service.
 * Скрывает, что за ней стоят два разных транспорта: публичное RemOnline API
 * (RoappService) и собственный бэкенд-восполнитель (CustomApiRoappService).
 * Потребители (в частности src1/domains/service/sync/roapp) зависят только
 * от этого интерфейса и токена ROAPP_GATEWAY, не от конкретных API.
 */
export interface RoappGateway {
    fetchEmployees(): Promise<EmployeeShort[]>;
    fetchOrderTypes(): Promise<OrderType[]>;
    fetchOrderStatuses(): Promise<OrderStatus[]>;
    fetchMarketingSources(): Promise<MarketingSourceShort[]>;

    fetchServiceCategories(): AsyncGenerator<Category[]>;
    fetchProductCategories(): AsyncGenerator<Category[]>;
    fetchServices(): AsyncGenerator<Service[]>;
    fetchProducts(): AsyncGenerator<Product[]>;

    fetchCreatedOrders(fromDate?: Date): AsyncGenerator<Order[]>;
    fetchUpdatedOrders(fromDate?: Date): AsyncGenerator<Order[]>;
    fetchOrdersClosedBetween(from: Date, to: Date): AsyncGenerator<Order[]>;
    fetchOrderItems(orderId: number): Promise<OrderItem[]>;

    fetchServiceBonuses(): Promise<ServiceBonusForEngeneer[]>;
    fetchServiceBonusById(id: number): Promise<ServiceBonusById | null>;

    createService(
        payload: CreateServiceRequest,
    ): Promise<CreateServiceResponse>;
    updateServicesFromFile(file: Buffer): Promise<UpdateServicesResponse>;
}

export const ROAPP_GATEWAY = Symbol('ROAPP_GATEWAY');
