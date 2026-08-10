import { Module } from '@nestjs/common';
import { CustomApiRoappService } from './custom-api-roapp.service';
import { CustomApiRoappHttpService } from './custom-api-roapp.instance';
import { CustomApiRoappController } from './custom-api-roapp.controller';

@Module({
    controllers: [CustomApiRoappController],
    providers: [CustomApiRoappHttpService, CustomApiRoappService],
    exports: [CustomApiRoappService],
})
export class CustomApiRoappModule {}
