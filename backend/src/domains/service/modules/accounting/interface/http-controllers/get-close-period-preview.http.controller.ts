import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClosePeriodPreviewResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetClosePeriodPreviewService } from '@/domains/service/modules/accounting/application/services/get-close-period-preview.service';

@ApiTags('Бухгалтерия: расчётный период')
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
