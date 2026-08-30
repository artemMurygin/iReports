import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BitrixSyncService } from '../../bitrix-sync.service';
import { UploadInitialBitrixDataCommand } from './upload-initial-bitrix-data.command';

@CommandHandler(UploadInitialBitrixDataCommand)
export class UploadInitialBitrixDataHandler implements ICommandHandler<
    UploadInitialBitrixDataCommand,
    void
> {
    constructor(private readonly syncService: BitrixSyncService) {}

    async execute(command: UploadInitialBitrixDataCommand): Promise<void> {
        const { fromDate } = command;

        await this.syncService.uploadEmployees();
        await this.syncService.uploadStages();
        await this.syncService.uploadDeviceTypes();
        await this.syncService.uploadLeadSources();
        await this.syncService.uploadEnums();
        await this.syncService.uploadSources();
        await this.syncService.uploadCreatedDeals(fromDate);
    }
}
