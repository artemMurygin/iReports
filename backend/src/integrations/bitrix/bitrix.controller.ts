import { Controller } from '@nestjs/common';
import { BitrixService } from './bitrix.service';

@Controller('bitrix')
export class BitrixController {
  constructor(private readonly bitrixService: BitrixService) {}
}
