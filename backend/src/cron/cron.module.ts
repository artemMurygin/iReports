import { Module } from '@nestjs/common';
import { BitrixSyncModule } from '../sync/bitrix/bitrix.module';
import { CronService } from './cron.service';
import { RoappSyncModule } from '../sync/roapp/roapp.module';

@Module({
  imports: [BitrixSyncModule, RoappSyncModule],
  providers: [CronService],
})
export class CronModule {}
