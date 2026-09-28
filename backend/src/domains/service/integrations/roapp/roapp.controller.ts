import { Controller, Get } from '@nestjs/common';
import { Public } from '@/shared/decorators/public.decorator';
import { RoappService } from './roapp.service';

@Controller('roapp')
export class RoappController {
    constructor(private readonly roapp: RoappService) {}

    // Public: вызывается из Google Apps Script (GoogleSheetsInterface),
    // у которого нет Bitrix-сессии — см. add-bitrix24-auth-and-rbac.
    @Public()
    @Get('service-categories')
    getServiceCategories() {
        return this.roapp.fetchAllServiceCategories();
    }
}
