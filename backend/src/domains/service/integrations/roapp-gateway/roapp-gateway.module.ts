import { Module } from '@nestjs/common';
import { RoappModule } from '../roapp/roapp.module';
import { CustomApiRoappModule } from '../custom-api-roapp/custom-api-roapp.module';
import { ROAPP_GATEWAY } from './roapp-gateway.port';
import { RoappGatewayAdapter } from './roapp-gateway.adapter';

@Module({
  imports: [RoappModule, CustomApiRoappModule],
  providers: [{ provide: ROAPP_GATEWAY, useClass: RoappGatewayAdapter }],
  exports: [ROAPP_GATEWAY],
})
export class RoappGatewayModule {}
