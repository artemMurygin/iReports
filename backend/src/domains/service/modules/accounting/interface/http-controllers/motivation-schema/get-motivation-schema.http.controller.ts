import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MotivationSchemaDetailResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetMotivationSchemaService } from '@/domains/service/modules/accounting/application/services/motivation-schema/get-motivation-schema.service';

@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
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
