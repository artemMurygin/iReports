import { Module } from '@nestjs/common';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import { DomainSyncStatusRepository } from './domain-sync-status.repository';

// Общий модуль (не @Global — импортируется явно там, где нужен): пишет
// RoappSyncModule (конец успешного тика RoappSyncCron), читает
// AccountingModule (ленивый кэш расчёта, Фаза 6). DatabaseModule уже
// @Global(), поэтому DatabaseService доступен репозиторию без импорта.
@Module({
    providers: [
        { provide: DOMAIN_SYNC_STATUS, useClass: DomainSyncStatusRepository },
    ],
    exports: [DOMAIN_SYNC_STATUS],
})
export class DomainSyncStatusModule {}
