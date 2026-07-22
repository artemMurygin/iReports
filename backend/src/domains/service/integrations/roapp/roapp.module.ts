import { Module } from '@nestjs/common';
import { RoappService } from './roapp.service';
import { RoappHttpService } from './roapp.instace';
import { RoappController } from './roapp.controller';

@Module({
  controllers: [RoappController],
  providers: [RoappHttpService, RoappService],
  exports: [RoappService],
})
export class RoappModule {}
