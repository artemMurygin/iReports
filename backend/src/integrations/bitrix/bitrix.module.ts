import { Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixController } from './bitrix.controller';
import { BitrixHttpService } from './bitrix.instance';
import { BitrixAuthService } from './bitrix-auth.service';

@Module({
  controllers: [BitrixController],
  providers: [BitrixService, BitrixHttpService, BitrixAuthService],
  exports: [BitrixService, BitrixAuthService],
})
export class BitrixModule {}
