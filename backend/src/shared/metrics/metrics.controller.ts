import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';
import { Public } from '../decorators/public.decorator';

// Глобальные SessionAuthGuard/CsrfGuard/PermissionsGuard (см. app.module.ts) закрывают все роуты
// по умолчанию — без @Public() Prometheus не смог бы скрейпить /metrics (получал бы 401, т.к.
// у скрейпера нет сессии iReports). Наследуется от PrometheusController библиотеки, чтобы не
// дублировать сбор метрик — переопределяет только видимость роута.
@Controller()
export class MetricsController extends PrometheusController {
    @Public()
    @Get()
    index(@Res({ passthrough: true }) response: Response) {
        return super.index(response);
    }
}
