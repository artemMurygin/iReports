import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiHttpService } from './ai.instance';

@Module({
    providers: [AiHttpService, AiService],
    exports: [AiService],
})
export class AiModule {}
