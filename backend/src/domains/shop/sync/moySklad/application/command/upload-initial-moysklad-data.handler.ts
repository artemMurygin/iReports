import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { MoySkladSyncService } from '../../moysklad-sync.service';
import { UploadInitialMoySkladDataCommand } from './upload-initial-moysklad-data.command';

@CommandHandler(UploadInitialMoySkladDataCommand)
export class UploadInitialMoySkladDataHandler
    implements ICommandHandler<UploadInitialMoySkladDataCommand, void>
{
    constructor(private readonly syncService: MoySkladSyncService) {}

    async execute(command: UploadInitialMoySkladDataCommand): Promise<void> {
        const { fromDate } = command;

        await this.syncService.uploadEmployees();
        await this.syncService.uploadProductFolders();
        await this.syncService.uploadProducts();
        await this.syncService.uploadServices();
        await this.syncService.uploadCreatedDemands(fromDate);
    }
}
