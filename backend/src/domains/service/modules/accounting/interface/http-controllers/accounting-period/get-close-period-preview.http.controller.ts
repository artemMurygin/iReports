import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClosePeriodPreviewResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetClosePeriodPreviewService } from '@/domains/service/modules/accounting/application/services/accounting-period/get-close-period-preview.service';

@ApiTags('Бухгалтерия: расчётный период')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
@Controller()
export class GetClosePeriodPreviewHttpController {
    constructor(
        private readonly getClosePeriodPreview: GetClosePeriodPreviewService,
    ) {}

    @Get(routesV1.service.accounting.period.closePreview)
    @ApiOperation({
        summary:
            'Сводка окна подтверждения закрытия периода: сотрудники, уволенные, фонд оплаты, неутверждённые строки плана, сотрудники без часов',
    })
    async get(
        @Param('period') period: string,
    ): Promise<ClosePeriodPreviewResponse> {
        return this.getClosePeriodPreview.execute('service', period);
    }
}
