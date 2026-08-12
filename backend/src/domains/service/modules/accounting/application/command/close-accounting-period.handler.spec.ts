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
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { UnapprovedSalesPlanRowsException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('CloseAccountingPeriodHandler', () => {
    const buildHandler = (overrides?: {
        plans?: SalesPlan[];
        schemas?: MotivationSchema[];
    }) => {
        const save = jest.fn().mockResolvedValue(undefined);
        const findByDirectionAndPeriod = jest.fn().mockResolvedValue(null);
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod,
            save,
        };

        const saveAll = jest.fn().mockResolvedValue(undefined);
        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll,
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByDirectionAndPeriod: jest.fn(),
        };

        const deleteCacheByPeriod = jest.fn().mockResolvedValue(undefined);
        const cacheRepo: AccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByDirectionAndPeriod: deleteCacheByPeriod,
        };

        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn(),
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(overrides?.schemas ?? []),
        };

        const salesPlanRepo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest
                .fn()
                .mockResolvedValue(overrides?.plans ?? []),
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

        return {
            handler,
            save,
            saveAll,
            deleteCacheByPeriod,
            periodRepo,
        };
    };

    const buildApprovedPlan = () =>
        withRequestContext(() => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                category: null,
                period: '2026-08',
                turnover: 1000,
                margin: 100,
                source: 'MANUAL',
            });
            plan.approve(1);
            return plan;
        });

    it('отклоняется со списком неутверждённых строк плана', async () => {
        const unapprovedPlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department: 1,
                category: null,
                period: '2026-08',
                turnover: 1000,
                margin: 100,
                source: 'MANUAL',
            }),
        );
        const { handler, save } = buildHandler({ plans: [unapprovedPlan] });

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new CloseAccountingPeriodCommand({
                        period: '2026-08',
                        closedBy: 1,
                    }),
                ),
            ),
        ).rejects.toThrow(UnapprovedSalesPlanRowsException);
        expect(save).not.toHaveBeenCalled();
    });

    it('при успехе создаёт снапшот по каждому сотруднику с личной схемой и закрывает период', async () => {
        const schema = withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });
        const { handler, save, saveAll, deleteCacheByPeriod } = buildHandler({
            plans: [buildApprovedPlan()],
            schemas: [schema],
        });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 7,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(response.closedBy).toBe(7);
        expect(save).toHaveBeenCalledTimes(1);
        expect(saveAll).toHaveBeenCalledTimes(1);
        const [, , , rows] = saveAll.mock.calls[0] as [
            string,
            string,
            string,
            { employeeId: number; total: number }[],
        ];
        expect(rows).toEqual([
            expect.objectContaining({ employeeId: 42, total: 2000 }),
        ]);
        expect(deleteCacheByPeriod).toHaveBeenCalledWith('service', '2026-08');
    });

    it('пустой список планов (плана вообще нет) не блокирует закрытие', async () => {
        const { handler, save } = buildHandler({ plans: [] });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(save).toHaveBeenCalledTimes(1);
    });
});
