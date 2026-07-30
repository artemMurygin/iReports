import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestsCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    // res.on('finish') вместо rxjs tap() — статус-код проставляется Nest'ом
    // уже после того, как обёрнутый handler отработал, поэтому только здесь он финальный.
    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      // req.route.path — параметризованный путь ('/deals/:id'), а не сырой req.url с ID,
      // иначе кардинальность лейблов росла бы неограниченно.
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      this.requestsCounter.inc(labels);
      this.requestDuration.observe(labels, durationSeconds);
    });

    return next.handle();
  }
}
