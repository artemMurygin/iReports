import { Module } from '@nestjs/common';
import { BitrixSyncModule } from '../sync/bitrix/bitrix.module';
import { CronService } from './cron.service';
import { RoappSyncModule } from '../sync/roapp/roapp.module';
import { MoySkladSyncModule } from '../sync/moySklad/moySklad.module';

@Module({
  imports: [BitrixSyncModule, RoappSyncModule, MoySkladSyncModule],
  providers: [CronService],
})
export class CronModule {}
