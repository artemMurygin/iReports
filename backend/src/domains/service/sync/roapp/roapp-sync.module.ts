import { Module } from '@nestjs/common';
import { RoappGatewayModule } from '../../integrations/roapp-gateway/roapp-gateway.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { RoappSyncService } from './roapp-sync.service';
import { RoappSyncCron } from './roapp-sync.cron';

@Module({
    imports: [RoappGatewayModule, DomainSyncStatusModule],
    providers: [RoappSyncService, RoappSyncCron],
})
export class RoappSyncModule {}
