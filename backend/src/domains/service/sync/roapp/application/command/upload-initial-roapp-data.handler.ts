import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoappSyncService } from '../../roapp-sync.service';
import { UploadInitialRoappDataCommand } from './upload-initial-roapp-data.command';

@CommandHandler(UploadInitialRoappDataCommand)
export class UploadInitialRoappDataHandler
    implements ICommandHandler<UploadInitialRoappDataCommand, void>
{
    constructor(private readonly syncService: RoappSyncService) {}

    async execute(command: UploadInitialRoappDataCommand): Promise<void> {
        const { fromDate } = command;

        await this.syncService.uploadEmployees();
        await this.syncService.uploadMarketingSources();
        await this.syncService.uploadOrderStatuses();
        await this.syncService.uploadOrderTypes();
        await this.syncService.uploadProductCategories();
        await this.syncService.uploadServiceCategories();
        await this.syncService.uploadServices();
        await this.syncService.uploadProducts();
        await this.syncService.uploadServiceBonuses();
        const orderIds = await this.syncService.uploadCreatedOrders(fromDate);
        await this.syncService.uploadOrderItems(orderIds);
    }
}
