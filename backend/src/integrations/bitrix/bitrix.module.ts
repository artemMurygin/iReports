import { Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixTasksService } from './bitrix-tasks.service';
import { BitrixController } from './bitrix.controller';
import { BitrixHttpService } from './bitrix.instance';
import { BitrixAuthService } from './bitrix-auth.service';
import { BitrixAuthModule } from './auth/bitrix-auth.module';

@Module({
    imports: [BitrixAuthModule],
    controllers: [BitrixController],
    providers: [
        BitrixService,
        BitrixTasksService,
        BitrixHttpService,
        BitrixAuthService,
    ],
    exports: [
        BitrixService,
        BitrixTasksService,
        BitrixAuthService,
        BitrixAuthModule,
    ],
})
export class BitrixModule {}
