import { Module } from '@nestjs/common';
import { BitrixSyncService } from './bitrix.service';
import { BitrixModule } from '../../integrations/bitrix/bitrix.module';

@Module({
  controllers: [],
  imports: [BitrixModule],
  providers: [BitrixSyncService],
  exports: [BitrixSyncService],
})
export class BitrixSyncModule {}
