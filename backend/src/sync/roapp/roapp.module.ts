import { Module } from '@nestjs/common';
import { RoappSyncService } from './roapp.service';
import { RoappModule } from '../../integrations/roapp/roapp.module';
import { CustomApiRoappModule } from '../../integrations/custom-api-roapp/custom-api-roapp.module';

@Module({
  controllers: [],
  providers: [RoappSyncService],
  imports: [RoappModule, CustomApiRoappModule],
  exports: [RoappSyncService],
})
export class RoappSyncModule {}
