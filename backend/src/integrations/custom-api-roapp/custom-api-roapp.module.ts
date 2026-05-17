import { Module } from '@nestjs/common';
import { CustomApiRoappService } from './custom-api-roapp.service';
import { CustomApiRoappHttpService } from './custom-api-roapp.instance';

@Module({
  controllers: [],
  providers: [CustomApiRoappHttpService, CustomApiRoappService],
  exports: [CustomApiRoappService],
})
export class CustomApiRoappModule {}
