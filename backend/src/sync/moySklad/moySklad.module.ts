import { Module } from '@nestjs/common';
import { MoySkladSyncService } from './moySklad.service';
import { MoyskladModule } from '../../integrations/moySklad/moysklad.module';

@Module({
  imports: [MoyskladModule],
  providers: [MoySkladSyncService],
  exports: [MoySkladSyncService],
})
export class MoySkladSyncModule {}
