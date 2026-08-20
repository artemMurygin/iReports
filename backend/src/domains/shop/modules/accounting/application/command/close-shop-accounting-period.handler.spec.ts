import { CloseShopAccountingPeriodHandler } from './close-shop-accounting-period.handler';
import { CloseShopAccountingPeriodCommand } from './close-shop-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/resolve-shop-employee-salary-rules.service';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { Period } from '@/shared/domain/period.value-object';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { UnapprovedSalesPlanRowsException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Зеркало domains/service/modules/accounting/application/command/
// close-accounting-period.handler.spec.ts (только shop-кейсы) — независимый
// тест для независимого хендлера CloseShopAccountingPeriodHandler (Фаза
// 13.5, issue #57).
describe('CloseShopAccountingPeriodHandler', () => {
    const buildHandler = (overrides?: {
        plans?: SalesPlan[];
        shopSchemas?: ShopMotivationSchema[];
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

        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn(),
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(overrides?.shopSchemas ?? []),
            // Схем на отдел в этих тестах нет — forAllTargets() сводится
            // ровно к findAllEmployeeTargets(), как и раньше (покрытие
            // разворачивания department-схемы в сотрудников — в
            // resolve-shop-employee-salary-rules.service.spec.ts).
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
        };

        const salaryRulesResolver = new ResolveShopEmployeeSalaryRulesService(
            shopMotivationSchemaRepo,
            {
                findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
                findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            } as unknown as ShopCalculationDataPort,
        );

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

        const shopContextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
                Promise.resolve({
                    employee: { id: employeeId, identities: [] },
                    period: {
                        direction: 'shop' as const,
                        period: period.getValue(),
                        ...period.getBounds(),
                        status: 'OPEN' as const,
                    },
                    erpData: { hoursWorked: 8 },
                    salesPerformanceDetail: null,
                    // Карта по категориям (Фаза 2 плана
                    // shop-sales-performance-by-category) — здесь всегда
                    // пустая, ни один тест этого файла не использует
                    // FloatPercent-правила.
                    salesPerformanceByCategory: new Map(),
                }),
            ),
        } as unknown as BuildShopCalculationContextService;

        const handler = new CloseShopAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            unitOfWork,
            shopContextBuilder,
            salaryRulesResolver,
        );

        return {
            handler,
            save,
            saveAll,
            deleteCacheByPeriod,
            periodRepo,
            shopContextBuilder,
        };
    };

    const buildApprovedPlan = () =>
        withRequestContext(() => {
            const plan = SalesPlan.create({
                direction: 'shop',
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
                direction: 'shop',
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
                    new CloseShopAccountingPeriodCommand({
                        period: '2026-08',
                        closedBy: 1,
                    }),
                ),
            ),
        ).rejects.toThrow(UnapprovedSalesPlanRowsException);
        expect(save).not.toHaveBeenCalled();
    });

    it('при успехе строит снапшот через shopMotivationSchemaRepo/shopContextBuilder и закрывает период', async () => {
        const schema = withRequestContext(() => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 250 },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад продавца',
                rules: [rule],
            });
        });
        const { handler, save, saveAll, deleteCacheByPeriod } = buildHandler({
            plans: [buildApprovedPlan()],
            shopSchemas: [schema],
        });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseShopAccountingPeriodCommand({
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
        expect(deleteCacheByPeriod).toHaveBeenCalledWith('shop', '2026-08');
    });

    it('пустой список планов (плана вообще нет) не блокирует закрытие', async () => {
        const { handler, save } = buildHandler({ plans: [] });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(save).toHaveBeenCalledTimes(1);
    });
});
