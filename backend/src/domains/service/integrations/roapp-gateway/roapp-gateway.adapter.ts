import { Injectable } from '@nestjs/common';
import { RoappService } from '../roapp/roapp.service';
import { CustomApiRoappService } from '../custom-api-roapp/custom-api-roapp.service';
import {
    RoappGateway,
    EmployeeShort,
    OrderType,
    OrderStatus,
    MarketingSourceShort,
    Order,
    OrderItem,
} from './roapp-gateway.port';
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

@Injectable()
export class RoappGatewayAdapter implements RoappGateway {
    constructor(
        private readonly roapp: RoappService,
        private readonly customApiRoapp: CustomApiRoappService,
    ) {}

    fetchEmployees(): Promise<EmployeeShort[]> {
        return this.roapp.fetchEmployees();
    }

    fetchOrderTypes(): Promise<OrderType[]> {
        return this.roapp.fetchOrderTypes();
    }

    fetchOrderStatuses(): Promise<OrderStatus[]> {
        return this.roapp.fetchOrderStatuses();
    }

    fetchMarketingSources(): Promise<MarketingSourceShort[]> {
        return this.roapp.fetchMarketingSources();
    }

    fetchServiceCategories(): AsyncGenerator<Category[]> {
        return this.roapp.fetchServicesCategories();
    }

    fetchProductCategories(): AsyncGenerator<Category[]> {
        return this.roapp.fetchProductsCategories();
    }

    fetchServices(): AsyncGenerator<Service[]> {
        return this.roapp.fetchServices();
    }

    fetchProducts(): AsyncGenerator<Product[]> {
        return this.roapp.fetchProducts();
    }

    fetchCreatedOrders(fromDate?: Date): AsyncGenerator<Order[]> {
        return this.roapp.fetchCreatedOrders(fromDate, 'created');
    }

    fetchUpdatedOrders(fromDate?: Date): AsyncGenerator<Order[]> {
        return this.roapp.fetchUpdatedOrders(fromDate, 'updated');
    }

    async fetchOrderItems(orderId: number): Promise<OrderItem[]> {
        const items = await this.roapp.fetchOrderItems(orderId);
        return items.filter((item): item is OrderItem => item != null);
    }

    fetchServiceBonuses(): Promise<ServiceBonusForEngeneer[]> {
        return this.customApiRoapp.getServiceBonusesForEngeneers();
    }

    fetchServiceBonusById(id: number): Promise<ServiceBonusById | null> {
        return this.customApiRoapp.getServiceBonusById(id);
    }

    createService(
        payload: CreateServiceRequest,
    ): Promise<CreateServiceResponse> {
        return this.customApiRoapp.createService(payload);
    }

    updateServicesFromFile(file: Buffer): Promise<UpdateServicesResponse> {
        return this.customApiRoapp.updateServices(file);
    }
}
