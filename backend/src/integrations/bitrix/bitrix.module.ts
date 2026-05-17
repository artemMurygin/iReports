import { Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixController } from './bitrix.controller';
import { BitrixHttpService } from './bitrix.instance';

@Module({
  controllers: [BitrixController],
  providers: [BitrixService, BitrixHttpService],
  exports: [BitrixService],
})
export class BitrixModule {}
