import { Module } from '@nestjs/common';
import { RoappGatewayModule } from '../../integrations/roapp-gateway/roapp-gateway.module';
import { RoappSyncService } from './roapp-sync.service';
import { RoappSyncCron } from './roapp-sync.cron';

@Module({
    imports: [RoappGatewayModule],
    providers: [RoappSyncService, RoappSyncCron],
})
export class RoappSyncModule {}
