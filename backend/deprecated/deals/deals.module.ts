import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { BitrixModule } from '../integrations/bitrix/bitrix.module';

@Module({
  controllers: [DealsController],
  providers: [DealsService],
  imports: [BitrixModule],
  exports: [DealsService],
})
export class DealsModule {}
