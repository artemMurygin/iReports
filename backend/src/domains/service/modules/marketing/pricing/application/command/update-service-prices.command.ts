import { Command, CommandProps } from '@/shared/domain/command.base';
import type { UpdateServicePricesItem } from 'ireports-contracts';

// items — форма запроса как есть из контракта (id/price/serviceCost);
// хендлер валидирует и оборачивает каждую строку в доменный VO
// ServicePriceChange перед сборкой XLSX (см. update-service-prices.handler.ts).
export class UpdateServicePricesCommand extends Command {
    readonly items: UpdateServicePricesItem[];

    constructor(props: CommandProps<UpdateServicePricesCommand>) {
        super(props);
        this.items = props.items;
    }
}
