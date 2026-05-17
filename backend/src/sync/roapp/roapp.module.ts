import { Module } from '@nestjs/common';
import { RoappSyncService } from './roapp.service';
import { RoappModule } from '../../integrations/roapp/roapp.module';

@Module({
  controllers: [],
  providers: [RoappSyncService],
  imports: [RoappModule],
})
export class RoappSyncModule {}
