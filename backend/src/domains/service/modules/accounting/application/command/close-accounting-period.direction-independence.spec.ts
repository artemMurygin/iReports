import { CloseAccountingPeriodHandler } from './close-accounting-period.handler';
import { CloseAccountingPeriodCommand } from './close-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { Period } from '@/shared/domain/period.value-object';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Расчётный период магазина заводится и закрывается независимо от периода
// сервиса (Фаза 11, issue #55/#56) — AccountingPeriod (Фаза 6) уже общая
// сущность для обоих направлений (уникальный ключ (direction, period), см.
// accounting-period.prisma), эта проверка защищает контракт "направление —
// часть ключа, а не просто период" от регрессии (например, случайной
// правки хендлера/репозитория, забывшей передать direction при
// чтении/записи).
describe('CloseAccountingPeriodHandler — независимость направлений', () => {
    it('закрытие периода service не переводит в CLOSED тот же период направления shop, и наоборот', async () => {
        // Один и тот же key-value store имитирует реальный уникальный ключ
        // (direction, period) в Postgres — если бы хендлер/репозиторий
        // где-то перепутали направление, эта проверка бы это поймала.
        const store = new Map<string, AccountingPeriod>();
        const key = (direction: string, period: string) =>
            `${direction}:${period}`;

        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: (direction, period) =>
                Promise.resolve(store.get(key(direction, period)) ?? null),
            save: (entity) => {
                store.set(key(entity.direction, entity.period), entity);
                return Promise.resolve();
            },
        };

        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll: jest.fn().mockResolvedValue(undefined),
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByDirectionAndPeriod: jest.fn(),
        };
        const cacheRepo: AccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByDirectionAndPeriod: jest.fn().mockResolvedValue(undefined),
        };
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
        };
        const salesPlanRepo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest.fn().mockResolvedValue([]),
        };
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const contextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
                Promise.resolve({
                    employee: { id: employeeId, identities: [] },
                    period: {
                        direction: 'service' as const,
                        period: period.getValue(),
                        ...period.getBounds(),
                        status: 'OPEN' as const,
                    },
                    erpData: { serviceCompletedItems: [], hoursWorked: 8 },
                    salesPerformanceDetail: null,
                }),
            ),
        } as unknown as BuildServiceCalculationContextService;

        const handler = new CloseAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            motivationSchemaRepo,
            salesPlanRepo,
            unitOfWork,
            contextBuilder,
        );

        await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    direction: 'service',
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );

        const shopPeriod = await periodRepo.findByDirectionAndPeriod(
            'shop',
            '2026-08',
        );
        expect(shopPeriod).toBeNull();

        const servicePeriod = await periodRepo.findByDirectionAndPeriod(
            'service',
            '2026-08',
        );
        expect(servicePeriod?.status).toBe('CLOSED');

        // Закрываем shop за тот же месяц отдельно — service должен остаться
        // закрытым, а не быть тронут повторной записью под другим ключом.
        await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    direction: 'shop',
                    period: '2026-08',
                    closedBy: 2,
                }),
            ),
        );

        const shopPeriodAfter = await periodRepo.findByDirectionAndPeriod(
            'shop',
            '2026-08',
        );
        expect(shopPeriodAfter?.status).toBe('CLOSED');
        const servicePeriodAfter = await periodRepo.findByDirectionAndPeriod(
            'service',
            '2026-08',
        );
        expect(servicePeriodAfter?.status).toBe('CLOSED');
        expect(servicePeriodAfter?.closedBy).toBe(1);
        expect(shopPeriodAfter?.closedBy).toBe(2);
    });
});
