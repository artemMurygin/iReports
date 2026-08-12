import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface CostChangeProps {
    productId: string;
    productName: string;
    oldCost: number | null;
    newCost: number;
}

// Изменение закупочной цены товара МойСклад (см. PRD, раздел 3а: "товар, старая/новая закупочная
// цена") — доменная замена ad-hoc объекта обновления, который легаси
// PriceMonitoringService.buildMoySkladUpdates собирал сразу в форме payload'а API МойСклад
// (`buyPrice.value` в копейках, `meta.href` на currency/атрибут и т.п.) — эта сериализация теперь
// дело инфраструктурного адаптера (Фаза 9), домен оперирует только доменными величинами цены.
export class CostChange extends ValueObject<CostChangeProps> {
    static create(props: CostChangeProps): CostChange {
        if (!props.productId.trim()) {
            throw new ArgumentInvalidException(
                'productId не может быть пустым',
            );
        }
        if (!props.productName.trim()) {
            throw new ArgumentInvalidException(
                'productName не может быть пустым',
            );
        }
        if (props.oldCost != null && props.oldCost < 0) {
            throw new ArgumentInvalidException(
                `oldCost не может быть отрицательной: ${props.oldCost}`,
            );
        }
        if (props.newCost < 0) {
            throw new ArgumentInvalidException(
                `newCost не может быть отрицательной: ${props.newCost}`,
            );
        }

        return new CostChange({ ...props });
    }

    getProductId(): string {
        return this.props.productId;
    }

    getProductName(): string {
        return this.props.productName;
    }

    getOldCost(): number | null {
        return this.props.oldCost;
    }

    getNewCost(): number {
        return this.props.newCost;
    }

    /** Меняется ли фактически закупочная цена (в т.ч. когда старой цены не было вовсе). */
    hasChanged(): boolean {
        return this.props.oldCost !== this.props.newCost;
    }
}
