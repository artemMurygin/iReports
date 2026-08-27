import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BitrixModule } from '../../integrations/bitrix/bitrix.module';
import { BitrixSyncService } from './bitrix-sync.service';
import { BitrixSyncCron } from './bitrix-sync.cron';
import { UploadInitialBitrixDataHandler } from './application/command/upload-initial-bitrix-data.handler';

@Module({
    imports: [BitrixModule, CqrsModule],
    providers: [BitrixSyncService, BitrixSyncCron, UploadInitialBitrixDataHandler],
})
export class BitrixSyncModule {}
