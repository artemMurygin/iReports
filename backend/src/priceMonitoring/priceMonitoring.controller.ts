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
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
    return subject.asObservable().pipe(map((event) => ({ data: event })));
  }
}
