import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
} from '@nestjs/common';
import { Public } from '@/shared/decorators/public.decorator';
import { CustomApiRoappService } from './custom-api-roapp.service';

@Controller('custom-api-roapp')
export class CustomApiRoappController {
    constructor(private readonly customApiRoapp: CustomApiRoappService) {}

    // Public: вызывается из Google Apps Script (GoogleSheetsInterface),
    // у которого нет Bitrix-сессии — см. add-bitrix24-auth-and-rbac.
    @Public()
    @Post('create-service')
    createService(@Body() body: unknown) {
        return this.customApiRoapp.createService(body);
    }

    @Get('service-bonus/:id')
    getServiceBonusById(@Param('id', ParseIntPipe) id: number) {
        return this.customApiRoapp.getServiceBonusById(id);
    }
}
