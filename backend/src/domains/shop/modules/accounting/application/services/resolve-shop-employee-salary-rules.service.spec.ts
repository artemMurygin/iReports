import { ResolveShopEmployeeSalaryRulesService } from './resolve-shop-employee-salary-rules.service';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Зеркало resolve-employee-salary-rules.service.spec.ts направления
// service. Регрессия на баг «расчёт зарплаты по нулям»: у сотрудника
// мотивация заведена схемой на его ОТДЕЛ, личной схемы нет — расчёт звал
// findByEmployee напрямую, получал пустой набор правил и отдавал нули по
// всем строкам отчёта.
describe('ResolveShopEmployeeSalaryRulesService', () => {
    const EMPLOYEE_ID = 42;
    const DEPARTMENT_ID = 7;

    const departmentSchema = () =>
        withRequestContext(() =>
            ShopMotivationSchema.create({
                targetType: 'Department',
                targetId: DEPARTMENT_ID,
                name: 'Мотивация отдела',
                rules: [
                    PayPerHourShopEntity.create({
                        type: 'PayPerHour',
                        name: 'Почасовая ставка (магазин)',
                        targetRole: 'OFFLINE_MANAGER',
                        config: { price: 100 },
                    }),
                ],
            }),
        );

    const personalSchema = () =>
        withRequestContext(() =>
            ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: EMPLOYEE_ID,
                name: 'Личная надбавка',
                rules: [
                    ProductSoldEntity.create({
                        type: 'ProductSold',
                        name: 'Продажа товара',
                        targetRole: 'OFFLINE_MANAGER',
                        config: {
                            category: null,
                            award: {
                                type: 'FixedPercent',
                                percent: 5,
                                salaryBasis: 'REVENUE',
                            },
                        },
                    }),
                ],
            }),
        );

    const buildService = (overrides?: {
        personal?: ShopMotivationSchema | null;
        department?: ShopMotivationSchema | null;
        departmentId?: number | null;
        allEmployeeTargets?: ShopMotivationSchema[];
        allDepartmentTargets?: ShopMotivationSchema[];
        employeesInDepartment?: { id: number; name: string }[];
    }) => {
        // findByDepartment держим отдельной ссылкой, а не достаём с уже
        // приведённого к порту объекта: eslint (unbound-method) справедливо
        // запрещает отрывать метод от интерфейса, даже ради expect().
        const findByDepartment = jest
            .fn()
            .mockResolvedValue(overrides?.department ?? null);

        const schemaRepo = {
            insert: jest.fn(),
            findByEmployee: jest
                .fn()
                .mockResolvedValue(overrides?.personal ?? null),
            findByDepartment,
            findByEmployees: jest
                .fn()
                .mockResolvedValue(
                    overrides?.personal ? [overrides.personal] : [],
                ),
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(overrides?.allEmployeeTargets ?? []),
            findAllDepartmentTargets: jest
                .fn()
                .mockResolvedValue(overrides?.allDepartmentTargets ?? []),
            findIdByTarget: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
        } as unknown as ShopMotivationSchemaRepositoryPort;

        const dataSource = {
            findEmployeeDepartmentId: jest
                .fn()
                .mockResolvedValue(
                    overrides?.departmentId === undefined
                        ? DEPARTMENT_ID
                        : overrides.departmentId,
                ),
            findEmployeesInDepartment: jest
                .fn()
                .mockResolvedValue(overrides?.employeesInDepartment ?? []),
        } as unknown as ShopCalculationDataPort;

        return {
            service: new ResolveShopEmployeeSalaryRulesService(
                schemaRepo,
                dataSource,
            ),
            findByDepartment,
        };
    };

    describe('forEmployee', () => {
        it('отдаёт правила схемы ОТДЕЛА сотруднику без личной схемы', async () => {
            const { service } = buildService({
                personal: null,
                department: departmentSchema(),
            });

            const { rules } = await service.forEmployee(EMPLOYEE_ID);

            expect(rules).toHaveLength(1);
            expect(rules[0].type).toBe('PayPerHour');
        });

        it('суммирует правила отдела и личной схемы, отдел первым', async () => {
            const { service } = buildService({
                personal: personalSchema(),
                department: departmentSchema(),
            });

            const { rules } = await service.forEmployee(EMPLOYEE_ID);

            expect(rules.map((rule) => rule.type)).toEqual([
                'PayPerHour',
                'ProductSold',
            ]);
        });

        it('не ищет схему отдела, если сотрудник ни к какому отделу не привязан', async () => {
            const { service, findByDepartment } = buildService({
                personal: personalSchema(),
                departmentId: null,
            });

            const { rules } = await service.forEmployee(EMPLOYEE_ID);

            expect(rules.map((rule) => rule.type)).toEqual(['ProductSold']);
            expect(findByDepartment).not.toHaveBeenCalled();
        });

        it('отдаёт пустой набор и версию "none" сотруднику без единой схемы', async () => {
            const { service } = buildService({
                personal: null,
                department: null,
            });

            const resolved = await service.forEmployee(EMPLOYEE_ID);

            expect(resolved.rules).toEqual([]);
            expect(resolved.schemasVersion).toBe('none');
        });

        // Версия схем — вход freshnessStamp ленивого кэша: она обязана
        // отличать «есть только личная» от «есть обе», иначе появление или
        // удаление схемы отдела не инвалидировало бы кэш.
        it('различает версии наборов «только личная» и «личная + отдел»', async () => {
            const personal = personalSchema();
            const onlyPersonal = await buildService({
                personal,
                departmentId: null,
            }).service.forEmployee(EMPLOYEE_ID);
            const both = await buildService({
                personal,
                department: departmentSchema(),
            }).service.forEmployee(EMPLOYEE_ID);

            expect(both.schemasVersion).not.toBe(onlyPersonal.schemasVersion);
        });
    });

    describe('forDepartment', () => {
        it('выдаёт правила отдела каждому сотруднику, включая тех, у кого нет личной схемы', async () => {
            const { service, findByDepartment } = buildService({
                personal: personalSchema(),
                department: departmentSchema(),
            });

            const resolved = await service.forDepartment(DEPARTMENT_ID, [
                EMPLOYEE_ID,
                99,
            ]);

            expect(
                resolved.get(EMPLOYEE_ID)?.rules.map((rule) => rule.type),
            ).toEqual(['PayPerHour', 'ProductSold']);
            expect(resolved.get(99)?.rules.map((rule) => rule.type)).toEqual([
                'PayPerHour',
            ]);
            // Схема отдела читается один раз на весь отдел, а не на
            // сотрудника («не должно быть N+1 запросов»).
            expect(findByDepartment).toHaveBeenCalledTimes(1);
        });
    });

    describe('forAllTargets', () => {
        it('разворачивает схему отдела в его сотрудников и объединяет с личными без дублей', async () => {
            const { service } = buildService({
                allEmployeeTargets: [personalSchema()],
                allDepartmentTargets: [departmentSchema()],
                employeesInDepartment: [
                    { id: EMPLOYEE_ID, name: 'Продавец Первый' },
                    { id: 99, name: 'Продавец Второй' },
                ],
            });

            const resolved = await service.forAllTargets();

            expect([...resolved.keys()].sort((a, b) => a - b)).toEqual([
                42, 99,
            ]);
            expect(
                resolved.get(EMPLOYEE_ID)?.rules.map((rule) => rule.type),
            ).toEqual(['PayPerHour', 'ProductSold']);
            expect(resolved.get(99)?.rules.map((rule) => rule.type)).toEqual([
                'PayPerHour',
            ]);
        });
    });
});
