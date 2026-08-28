import { Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';
import { MoySkladSyncService } from '@/domains/shop/sync/moySklad/moysklad-sync.service';
import type { ErpPeriodSyncPort } from '@/shared/application/ports/erp-period-sync.port';

// Реализация ERP_PERIOD_SYNC для shop: отгрузки МойСклада с датой в месяце
// — тем же MoySkladSyncService, что и MoySkladSyncCron, под той же
// блокировкой направления (синк закрытия и тик крона не идут параллельно).
@Injectable()
export class MoySkladErpPeriodSyncAdapter implements ErpPeriodSyncPort {
    constructor(
        private readonly syncService: MoySkladSyncService,
        private readonly lock: DirectionSyncLock,
    ) {}

    async syncPeriod(period: Period): Promise<void> {
        const { from, to } = period.getBounds();
        await this.lock.runExclusive('shop', async () => {
            await this.syncService.uploadDemandsByMoment(from, to);
        });
    }
}
