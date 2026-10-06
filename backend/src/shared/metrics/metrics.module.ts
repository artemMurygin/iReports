import { Global, Module } from '@nestjs/common';
import {
    PrometheusModule,
    makeCounterProvider,
    makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { AllExceptionsFilter } from '../exceptions/all-exceptions.filter';
import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsController } from './metrics.controller';

const metricProviders = [
    makeCounterProvider({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
    }),
    makeHistogramProvider({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    makeCounterProvider({
        name: 'http_request_errors_total',
        help: 'Total HTTP error responses by error code',
        labelNames: ['method', 'route', 'status_code', 'error_code'],
    }),
];

// Глобальный: AllExceptionsFilter (получаем его через app.get в main.ts) и
// HttpMetricsMiddleware (AppModule.configure) инжектят метрики.
@Global()
@Module({
    imports: [
        PrometheusModule.register({
            path: '/metrics',
            controller: MetricsController,
            defaultMetrics: { enabled: true },
        }),
    ],
    providers: [...metricProviders, HttpMetricsMiddleware, AllExceptionsFilter],
    exports: [...metricProviders, HttpMetricsMiddleware, AllExceptionsFilter],
})
export class MetricsModule {}
