import { Controller, MessageEvent, Param, Sse } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    finalize,
    interval,
    map,
    merge,
    Observable,
    Subject,
    takeUntil,
} from 'rxjs';
import { routesV1 } from '@/config/app.routes';
import { SubscribePriceImportJobProgressService } from '../../application/services/subscribe-price-import-job-progress.service';

// Heartbeat каждые 20с — то же значение и то же назначение, что у легаси
// `PriceMonitoringController.getProgress` (src/TODO/priceMonitoring/priceMonitoring.controller.ts):
// держит SSE-соединение живым сквозь таймаут Nginx (без heartbeat Nginx
// закрывает простаивающее соединение раньше, чем придёт следующий реальный
// прогресс-евент — особенно на медленных этапах пайплайна вроде загрузки
// каталога МойСклад). НЕ уменьшать/удалять при рефакторинге — см. PRD и
// критерий готовности Фазы 10 плана.
const HEARTBEAT_INTERVAL_MS = 20_000;

// Новый дом SSE GET /price-monitoring/:uuid из backend/src/TODO/priceMonitoring
// (Фаза 10) — тот же приём merge(events$, heartbeat$) + finalize/takeUntil,
// что и в легаси: heartbeat останавливается сам, как только поток реальных
// событий джобы завершается (COMPLETED/FAILED, см.
// InMemoryPriceImportJobStore.save — Subject.complete() на терминальном
// статусе). Данные каждого события — снапшот через тот же маппер
// toPriceImportJobStatusResponse, что и у GET .../status, чтобы поллинг и
// стрим отдавали одинаковую форму.
@ApiTags('Маркетинг: импорт цен магазина')
@Controller()
export class SubscribePriceImportJobProgressHttpController {
    constructor(
        private readonly subscribeProgress: SubscribePriceImportJobProgressService,
    ) {}

    @Sse(routesV1.shop.marketing.pricing.importCostsProgress)
    @ApiOperation({
        summary: 'SSE-поток прогресса джобы импорта цен (heartbeat 20с)',
    })
    @ApiParam({
        name: 'id',
        description: 'id джобы (см. ответ POST .../import-costs)',
    })
    progress(@Param('id') id: string): Observable<MessageEvent> {
        // Синхронный throw до построения потока — SubscribePriceImportJobProgressService.execute
        // бросает PriceImportJobNotFoundException немедленно для неизвестного id, тот же момент
        // проверки, что и у легаси (`if (!subject) throw new NotFoundException(...)` до merge()).
        const job$ = this.subscribeProgress.execute(id);

        const done$ = new Subject<void>();
        const events$ = job$.pipe(
            finalize(() => done$.next()),
            map((status) => ({ data: status })),
        );
        const heartbeat$ = interval(HEARTBEAT_INTERVAL_MS).pipe(
            takeUntil(done$),
            map(() => ({ data: { type: 'heartbeat' } })),
        );

        return merge(events$, heartbeat$);
    }
}
