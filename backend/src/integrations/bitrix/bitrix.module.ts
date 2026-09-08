import { Module } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixController } from './bitrix.controller';
import { BitrixHttpService } from './bitrix.instance';
import { BitrixAuthService } from './bitrix-auth.service';
import { BitrixAuthModule } from './auth/bitrix-auth.module';
import { BitrixTasksGatewayAdapter } from './bitrix-tasks-gateway.adapter';
import { BITRIX_TASKS_GATEWAY } from './ports/bitrix-tasks-gateway.port';

@Module({
    imports: [BitrixAuthModule],
    controllers: [BitrixController],
    providers: [
        BitrixService,
        BitrixHttpService,
        BitrixAuthService,
        {
            provide: BITRIX_TASKS_GATEWAY,
            useClass: BitrixTasksGatewayAdapter,
        },
    ],
    exports: [
        BitrixService,
        BitrixAuthService,
        BitrixAuthModule,
        BITRIX_TASKS_GATEWAY,
    ],
})
export class BitrixModule {}
