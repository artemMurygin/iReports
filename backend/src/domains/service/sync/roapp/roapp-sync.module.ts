import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RoappGatewayModule } from '../../integrations/roapp-gateway/roapp-gateway.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { DirectionSyncLockModule } from '@/shared/infrastructure/sync-lock/direction-sync-lock.module';
import { RoappSyncService } from './roapp-sync.service';
import { RoappSyncCron } from './roapp-sync.cron';
import { UploadInitialRoappDataHandler } from './application/command/upload-initial-roapp-data.handler';

// RoappSyncService и DirectionSyncLockModule экспортируются для
// AccountingModule: адаптер синка месяца по требованию
// (RoappErpPeriodSyncAdapter, PRD 1 docs/payroll-closing-and-accrual)
// вызывает тот же сервис под той же блокировкой направления, что и крон.
@Module({
    imports: [
        RoappGatewayModule,
        DomainSyncStatusModule,
        DirectionSyncLockModule,
        CqrsModule,
    ],
    providers: [RoappSyncService, RoappSyncCron, UploadInitialRoappDataHandler],
    exports: [RoappSyncService, DirectionSyncLockModule],
})
export class RoappSyncModule {}
