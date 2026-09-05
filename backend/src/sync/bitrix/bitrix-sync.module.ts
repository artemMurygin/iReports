import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BitrixModule } from '../../integrations/bitrix/bitrix.module';
import { BitrixSyncService } from './bitrix-sync.service';
import { BitrixSyncCron } from './bitrix-sync.cron';
import { UploadInitialBitrixDataHandler } from './application/command/upload-initial-bitrix-data.handler';
import { BITRIX_EMPLOYEE_UPSERT_PORT } from './application/ports/bitrix-employee-upsert.port';
import { BitrixEmployeeUpsertAdapter } from './infrastructure/bitrix-employee-upsert.adapter';

@Module({
    imports: [BitrixModule, CqrsModule],
    providers: [
        BitrixSyncService,
        BitrixSyncCron,
        UploadInitialBitrixDataHandler,
        {
            provide: BITRIX_EMPLOYEE_UPSERT_PORT,
            useClass: BitrixEmployeeUpsertAdapter,
        },
    ],
    // BITRIX_EMPLOYEE_UPSERT_PORT потребляется src/modules/auth (self-heal
    // отсутствующего BitrixEmployee на логине, design.md Decision 11).
    exports: [BITRIX_EMPLOYEE_UPSERT_PORT],
})
export class BitrixSyncModule {}
