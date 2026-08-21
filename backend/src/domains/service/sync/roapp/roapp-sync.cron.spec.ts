import { RoappSyncCron } from './roapp-sync.cron';
import { RoappSyncService } from './roapp-sync.service';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { DirectionSyncLock } from '@/shared/infrastructure/sync-lock/direction-sync-lock';

// Штамп синхронизации (DomainSyncStatus, Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md) обновляется ровно тогда, когда
// крон реально считает себя успешным — по failedSince, которое сбрасывается
// только на этой же ветке кода (см. RoappSyncCron.run()).
describe('RoappSyncCron', () => {
    const buildCron = () => {
        const syncService = {
            uploadUpdatedOrders: jest.fn().mockResolvedValue([1, 2]),
            uploadOrderItems: jest.fn().mockResolvedValue(undefined),
        } as unknown as RoappSyncService;
        const markSuccessful = jest
            .fn<Promise<void>, [string]>()
            .mockResolvedValue(undefined);
        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt: jest.fn(),
            markSuccessful,
        };
        const cron = new RoappSyncCron(
            syncService,
            domainSyncStatus,
            new DirectionSyncLock(),
        );
        return { cron, syncService, markSuccessful };
    };

    it('фиксирует штамп синхронизации направления service при успешном тике', async () => {
        const { cron, markSuccessful } = buildCron();

        await cron.run();

        expect(markSuccessful).toHaveBeenCalledWith('service');
    });

    it('не фиксирует штамп, если синхронизация упала', async () => {
        const syncService = {
            uploadUpdatedOrders: jest
                .fn()
                .mockRejectedValue(new Error('Roapp недоступен')),
            uploadOrderItems: jest.fn(),
        } as unknown as RoappSyncService;
        const markSuccessful = jest
            .fn<Promise<void>, [string]>()
            .mockResolvedValue(undefined);
        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt: jest.fn(),
            markSuccessful,
        };
        const cron = new RoappSyncCron(
            syncService,
            domainSyncStatus,
            new DirectionSyncLock(),
        );

        await cron.run();

        expect(markSuccessful).not.toHaveBeenCalled();
    });
});
