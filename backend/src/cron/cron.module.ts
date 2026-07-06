import { Module } from '@nestjs/common';
import { BitrixSyncModule } from '../sync/bitrix/bitrix.module';
import { CronService } from './cron.service';
import { RoappSyncModule } from '../sync/roapp/roapp.module';
import { CustomApiRoappSyncModule } from '../sync/custom-api-roapp/custom-api-roapp.module';

@Module({
  imports: [BitrixSyncModule, RoappSyncModule, CustomApiRoappSyncModule],
  providers: [CronService],
})
export class CronModule {}
