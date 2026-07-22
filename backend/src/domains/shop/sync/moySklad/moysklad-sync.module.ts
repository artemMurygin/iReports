import { Module } from '@nestjs/common';
import { MoyskladModule } from '../../integrations/moySklad/moysklad.module';
import { MoySkladSyncService } from './moysklad-sync.service';
import { MoySkladSyncCron } from './moysklad-sync.cron';

@Module({
  imports: [MoyskladModule],
  providers: [MoySkladSyncService, MoySkladSyncCron],
})
export class MoySkladSyncModule {}
