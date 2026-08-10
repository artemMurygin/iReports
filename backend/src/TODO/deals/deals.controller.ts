import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DealsService } from './deals.service';

@Controller('deals')
export class DealsController {
    constructor(private readonly dealsService: DealsService) {}

    @Get()
    async getDeals(@Query('from') from: string, @Query('to') to: string) {
        if (!from || !to) {
            throw new BadRequestException('Параметры from и to обязательны');
        }

        const fromDate = new Date(from);
        const toDate = new Date(to);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new BadRequestException(
                'Неверный формат даты. Используйте ISO 8601: 2026-01-01 или 2026-01-01T00:00:00Z',
            );
        }

        const deals = await this.dealsService.getDeals(fromDate, toDate);
        return { total: deals.length, deals };
    }

    @Get('stages')
    async getStages() {
        return this.dealsService.getStages();
    }

    @Get('models')
    async getModels() {
        return this.dealsService.getDeviceTypes();
    }

    @Get('managers')
    async getManagers() {
        return this.dealsService.getDealsManagers();
    }

    @Get('sources')
    async getSources() {
        return this.dealsService.getDealsSources();
    }

    @Get('stage-groups')
    async getStageGroups() {
        return this.dealsService.getStageGroups();
    }
}
