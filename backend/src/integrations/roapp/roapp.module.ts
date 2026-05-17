import { Module } from '@nestjs/common';
import { RoappService } from './roapp.service';
import { RoappHttpService } from './roapp.instace';

@Module({
  controllers: [],
  providers: [RoappHttpService, RoappService],
  exports: [RoappService],
})
export class RoappModule {}
