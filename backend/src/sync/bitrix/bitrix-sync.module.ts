import { Module } from '@nestjs/common';
import { BitrixModule } from '../../integrations/bitrix/bitrix.module';
import { BitrixSyncService } from './bitrix-sync.service';
import { BitrixSyncCron } from './bitrix-sync.cron';

@Module({
  imports: [BitrixModule],
  providers: [BitrixSyncService, BitrixSyncCron],
})
export class BitrixSyncModule {}
