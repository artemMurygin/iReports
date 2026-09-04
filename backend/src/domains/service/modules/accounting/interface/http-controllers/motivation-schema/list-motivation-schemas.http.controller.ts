import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListMotivationSchemasResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListMotivationSchemasQueryDto } from '../dto/list-motivation-schemas-query.dto';
import { ListMotivationSchemasService } from '@/domains/service/modules/accounting/application/services/list-motivation-schemas.service';

@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class ListMotivationSchemasHttpController {
    constructor(
        private readonly listMotivationSchemas: ListMotivationSchemasService,
    ) {}

    @Get(routesV1.service.motivationSchema.root)
    @ApiOperation({
        summary:
            'Список мотивационных схем направления сервис (с ≥1 правилом направления service)',
    })
    async list(
        @Query() query: ListMotivationSchemasQueryDto,
    ): Promise<ListMotivationSchemasResponse> {
        return this.listMotivationSchemas.execute(query);
    }
}
