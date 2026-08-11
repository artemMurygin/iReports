import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Таблица-singleton (не более одной строки на направление, PK = direction) —
// без доменных событий и без бизнес-инвариантов, поэтому напрямую через
// DatabaseService, минуя PrismaRepository/write()-транзакцию (тот же приём,
// что и в RoappSyncService — см. src/domains/service/sync/roapp/roapp-sync.service.ts):
// это не агрегат, чьи события нужно опубликовать после коммита, а чистый
// инфраструктурный штамп.
@Injectable()
export class DomainSyncStatusRepository implements DomainSyncStatusPort {
    constructor(private readonly db: DatabaseService) {}

    async getLastSuccessfulSyncAt(
        direction: AccountingDirection,
    ): Promise<Date | null> {
        const record = await this.db.domainSyncStatus.findUnique({
            where: { direction },
        });
        return record?.lastSuccessfulSyncAt ?? null;
    }

    async markSuccessful(
        direction: AccountingDirection,
        at: Date = new Date(),
    ): Promise<void> {
        await this.db.domainSyncStatus.upsert({
            where: { direction },
            create: { direction, lastSuccessfulSyncAt: at },
            update: { lastSuccessfulSyncAt: at },
        });
    }
}
