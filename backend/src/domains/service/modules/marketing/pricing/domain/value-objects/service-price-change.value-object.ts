import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface ServicePriceChangeProps {
    serviceId: number;
    price: number;
    serviceCost: number;
}

// Строка обновления цены услуги RoApp (Фаза 7,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// перенос легаси `UpdateServicePricesInRoappItem`
// (src/TODO/priceMonitoring/dto/updateServicePricesInRoapp.dto.ts) в
// доменный VO с инвариантами неотрицательности: легаси DTO принимала
// `price`/`serviceCost` как произвольные числа (z.number()), домен —
// строже. Агрегат для этой операции не нужен (см. PRD, раздел 3б,
// "синхронная stateless-операция") — VO лишь валидирует одну строку
// батча перед сборкой XLSX.
export class ServicePriceChange extends ValueObject<ServicePriceChangeProps> {
    static create(props: ServicePriceChangeProps): ServicePriceChange {
        if (!Number.isInteger(props.serviceId) || props.serviceId <= 0) {
            throw new ArgumentInvalidException(
                `serviceId должен быть положительным целым числом, получено: ${props.serviceId}`,
            );
        }
        if (props.price < 0) {
            throw new ArgumentInvalidException(
                `price не может быть отрицательной (serviceId=${props.serviceId}): ${props.price}`,
            );
        }
        if (props.serviceCost < 0) {
            throw new ArgumentInvalidException(
                `serviceCost не может быть отрицательной (serviceId=${props.serviceId}): ${props.serviceCost}`,
            );
        }

        return new ServicePriceChange({ ...props });
    }

    getServiceId(): number {
        return this.props.serviceId;
    }

    getPrice(): number {
        return this.props.price;
    }

    getServiceCost(): number {
        return this.props.serviceCost;
    }
}
