import { Module } from '@nestjs/common';
import { BitrixSyncModule } from '../sync/bitrix/bitrix.module';
import { CronService } from './cron.service';

@Module({
  imports: [BitrixSyncModule],
  providers: [CronService],
})
export class CronModule {}
