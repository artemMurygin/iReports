import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { CronService } from './cron.service';

@Module({
  imports: [DealsModule],
  providers: [CronService],
})
export class CronModule {}
