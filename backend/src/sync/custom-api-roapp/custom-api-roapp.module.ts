import { Module } from '@nestjs/common';
import { CustomApiRoappSyncService } from './custom-api-roapp.service';
import { CustomApiRoappModule } from '../../integrations/custom-api-roapp/custom-api-roapp.module';

@Module({
  providers: [CustomApiRoappSyncService],
  imports: [CustomApiRoappModule],
})
export class CustomApiRoappSyncModule {}
