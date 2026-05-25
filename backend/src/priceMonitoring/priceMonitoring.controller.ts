import {
  Body,
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import type { JobProgressEvent } from './priceMonitoring.types';
import { interval, merge, Observable, Subject } from 'rxjs';
import { finalize, map, takeUntil } from 'rxjs/operators';
import { PriceMonitoringService } from './priceMonitoring.service';
import { PriceMonitoringProgressService } from './priceMonitoring.progress.service';
import { UpdateShopProductsCostsDTO } from './dto/updateShopProductsCosts.dto';

@Controller('price-monitoring')
export class PriceMonitoringController {
  constructor(
    private readonly priceMonitoringService: PriceMonitoringService,
    private readonly progressService: PriceMonitoringProgressService,
  ) {}

  @Post('update-shop-products-costs')
  updateShopProductsCosts(@Body() body: UpdateShopProductsCostsDTO) {
    const id = crypto.randomUUID();
    this.priceMonitoringService.updateShopProductsCosts(body.file, id);
    return { id };
  }

  @Get(':uuid/status')
  getStatus(@Param('uuid') uuid: string): JobProgressEvent {
    if (!this.progressService.has(uuid)) {
      throw new NotFoundException(`Job ${uuid} not found`);
    }
    return (
      this.progressService.getLatest(uuid) ?? {
        step: 'pending',
        message: 'Ожидание...',
        status: 'progress',
      }
    );
  }

  @Sse(':uuid')
  getProgress(@Param('uuid') uuid: string): Observable<MessageEvent> {
    const subject = this.progressService.getSubject(uuid);
    if (!subject) throw new NotFoundException(`Job ${uuid} not found`);

    // Сигнал для остановки heartbeat при завершении задачи
    const done$ = new Subject<void>();

    const events$ = subject.asObservable().pipe(
      finalize(() => done$.next()),
      map((event) => ({ data: event } as MessageEvent)),
    );

    // Heartbeat каждые 20 сек чтобы Nginx не закрыл соединение по таймауту
    const heartbeat$ = interval(20_000).pipe(
      takeUntil(done$),
      map(() => ({ data: { type: 'heartbeat' } } as MessageEvent)),
    );

    return merge(events$, heartbeat$);
  }
}
