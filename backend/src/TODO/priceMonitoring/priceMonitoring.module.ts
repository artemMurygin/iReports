import { Module } from '@nestjs/common';
import { PriceMonitoringController } from './priceMonitoring.controller';
import { PriceMonitoringService } from './priceMonitoring.service';
import { PriceMonitoringProgressService } from './priceMonitoring.progress.service';
import { AiModule } from '../../integrations/ai/ai.module';
import { GoogleSheetsModule } from '../../integrations/google-sheets/google-sheets.module';
import { MoyskladModule } from '../../domains/shop/integrations/moySklad/moysklad.module';
import { RoappModule } from '../../domains/service/integrations/roapp/roapp.module';
import { CustomApiRoappModule } from '../../domains/service/integrations/custom-api-roapp/custom-api-roapp.module';

@Module({
    imports: [
        AiModule,
        GoogleSheetsModule,
        MoyskladModule,
        RoappModule,
        CustomApiRoappModule,
    ],
    controllers: [PriceMonitoringController],
    providers: [PriceMonitoringService, PriceMonitoringProgressService],
})
export class PriceMonitoringModule {}
