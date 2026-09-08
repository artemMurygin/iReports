import { Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';
import { RoappSyncService } from '@/domains/service/sync/roapp/roapp-sync.service';
import type { ErpPeriodSyncPort } from '@/shared/application/ports/erp-period-sync.port';

// Реализация ERP_PERIOD_SYNC для service: заказы RemOnline, закрытые в
// месяце, и их позиции — тем же RoappSyncService, что и RoappSyncCron, под
// той же блокировкой направления (синк закрытия и тик крона не идут
// параллельно).
@Injectable()
export class RoappErpPeriodSyncAdapter implements ErpPeriodSyncPort {
    constructor(
        private readonly syncService: RoappSyncService,
        private readonly lock: DirectionSyncLock,
    ) {}

    async syncPeriod(period: Period): Promise<void> {
        const { from, to } = period.getBounds();
        await this.lock.runExclusive('service', async () => {
            await this.syncService.uploadOrdersClosedBetween(from, to);
        });
    }
}
