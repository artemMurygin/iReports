import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { NextFunction, Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { routeLabel } from '../logger/http-route';

/**
 * Middleware вместо interceptor: interceptor не срабатывает для запросов,
 * отклонённых guard'ами/фильтрами до роутинга и для несовпавших URL, а
 * метрики должны видеть и 401/404.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
    constructor(
        @InjectMetric('http_requests_total')
        private readonly requestsCounter: Counter<string>,
        @InjectMetric('http_request_duration_seconds')
        private readonly requestDuration: Histogram<string>,
    ) {}

    use(req: Request, res: Response, next: NextFunction): void {
        const path = (req.originalUrl ?? req.url).split('?')[0];
        if (path === '/metrics') {
            next();
            return;
        }

        const start = process.hrtime.bigint();

        // Статус-код финален только на 'finish'. routeLabel — параметризованный
        // путь ('/deals/:id'), а не сырой URL с ID: иначе кардинальность
        // лейблов росла бы неограниченно (см. http-route.ts).
        res.on('finish', () => {
            const durationSeconds =
                Number(process.hrtime.bigint() - start) / 1e9;
            const labels = {
                method: req.method,
                route: routeLabel(req),
                status_code: String(res.statusCode),
            };
            this.requestsCounter.inc(labels);
            this.requestDuration.observe(labels, durationSeconds);
        });

        next();
    }
}
