import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MotivationSchemaDetailResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetMotivationSchemaService } from '@/domains/service/modules/accounting/application/services/get-motivation-schema.service';

@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class GetMotivationSchemaHttpController {
    constructor(
        private readonly getMotivationSchema: GetMotivationSchemaService,
    ) {}

    @Get(routesV1.service.motivationSchema.byId)
    @ApiOperation({
        summary:
            'Мотивационная схема направления сервис по id со всеми правилами',
    })
    async get(
        @Param('id') id: string,
    ): Promise<MotivationSchemaDetailResponse> {
        return this.getMotivationSchema.execute(id);
    }
}
