import { Module } from '@nestjs/common';
import { BitrixModule } from '@/integrations/bitrix/bitrix.module';
import { SalaryTaskStatusSyncService } from './salary-task-status-sync.service';
import { SalaryTaskStatusSyncCron } from './salary-task-status-sync.cron';

// Раздел 8 tasks.md (add-task-based-salary-rule) — сквозной модуль вне
// domains/{service,shop}, по аналогии с BitrixSyncModule
// (src/sync/bitrix/bitrix-sync.module.ts). Импортирует BitrixModule за
// BitrixService (fetchTaskStatusesBatch); DatabaseService доступен без
// импорта — DatabaseModule глобальный (@Global()).
@Module({
    imports: [BitrixModule],
    providers: [SalaryTaskStatusSyncService, SalaryTaskStatusSyncCron],
})
export class SalaryTaskStatusSyncModule {}
