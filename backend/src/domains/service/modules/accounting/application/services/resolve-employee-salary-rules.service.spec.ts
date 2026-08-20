import { ResolveEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/service-completed.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Регрессия на баг «расчёт зарплаты по нулям»: у сотрудника мотивация
// заведена схемой на его ОТДЕЛ, личной схемы нет — расчёт звал
// findByEmployee напрямую, получал пустой набор правил и отдавал нули по
// всем строкам отчёта. Все зависимости — чистые in-memory фейки, без NestJS
// DI и без БД (тот же стиль, что и у остальных юнит-тестов accounting).
describe('ResolveEmployeeSalaryRulesService', () => {
    const EMPLOYEE_ID = 14;
    const DEPARTMENT_ID = 160;

    const departmentSchema = () =>
        withRequestContext(() =>
            MotivationSchema.create({
                targetType: 'Department',
                targetId: DEPARTMENT_ID,
                name: 'Мотивация отдела',
                rules: [
                    PayPerHoursEntity.create({
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        config: { price: 300 },
                    }),
                ],
            }),
        );

    const personalSchema = () =>
        withRequestContext(() =>
            MotivationSchema.create({
                targetType: 'Employee',
                targetId: EMPLOYEE_ID,
                name: 'Личная надбавка',
                rules: [
                    ServiceCompletedEntity.create({
                        type: 'ServiceCompleted',
                        name: 'Оплата за выполнение услуг',
                        targetRole: 'ENGINEER',
                        config: { award: { type: 'ServiceFixed' } },
                    }),
                ],
            }),
        );

    const buildService = (overrides?: {
        personal?: MotivationSchema | null;
        department?: MotivationSchema | null;
        departmentId?: number | null;
        allEmployeeTargets?: MotivationSchema[];
        allDepartmentTargets?: MotivationSchema[];
        employeesInDepartment?: { id: number; name: string }[];
    }) => {
        const schemaRepo = {
            insert: jest.fn(),
            findByEmployee: jest
                .fn()
                .mockResolvedValue(overrides?.personal ?? null),
            findByDepartment: jest
                .fn()
                .mockResolvedValue(overrides?.department ?? null),
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
        };

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
        };

        const service = new ResolveEmployeeSalaryRulesService(
            schemaRepo,
            dataSource as unknown as ServiceCalculationDataPort,
        );

        return { service, schemaRepo, dataSource };
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
                'ServiceCompleted',
            ]);
        });

        it('не ищет схему отдела, если сотрудник ни к какому отделу не привязан', async () => {
            const { service, schemaRepo } = buildService({
                personal: personalSchema(),
                departmentId: null,
            });

            const { rules } = await service.forEmployee(EMPLOYEE_ID);

            expect(rules.map((rule) => rule.type)).toEqual([
                'ServiceCompleted',
            ]);
            expect(schemaRepo.findByDepartment).not.toHaveBeenCalled();
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
        // удаление схемы отдела не инвалидировало бы кэш и сотрудник
        // продолжил бы считаться по прежнему набору правил.
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
            const { service, schemaRepo } = buildService({
                personal: personalSchema(),
                department: departmentSchema(),
            });

            const resolved = await service.forDepartment(DEPARTMENT_ID, [
                EMPLOYEE_ID,
                99,
            ]);

            expect(resolved.get(EMPLOYEE_ID)?.rules.map((r) => r.type)).toEqual(
                ['PayPerHour', 'ServiceCompleted'],
            );
            expect(resolved.get(99)?.rules.map((r) => r.type)).toEqual([
                'PayPerHour',
            ]);
            // Схема отдела читается один раз на весь отдел, а не на
            // сотрудника (см. PRD: "не должно быть N+1 запросов").
            expect(schemaRepo.findByDepartment).toHaveBeenCalledTimes(1);
        });
    });

    describe('forAllTargets', () => {
        it('разворачивает схему отдела в его сотрудников и объединяет с личными без дублей', async () => {
            const { service } = buildService({
                allEmployeeTargets: [personalSchema()],
                allDepartmentTargets: [departmentSchema()],
                employeesInDepartment: [
                    { id: EMPLOYEE_ID, name: 'Олег Фадеев' },
                    { id: 99, name: 'Второй Сотрудник' },
                ],
            });

            const resolved = await service.forAllTargets();

            expect([...resolved.keys()].sort()).toEqual([14, 99]);
            expect(resolved.get(EMPLOYEE_ID)?.rules.map((r) => r.type)).toEqual(
                ['PayPerHour', 'ServiceCompleted'],
            );
            expect(resolved.get(99)?.rules.map((r) => r.type)).toEqual([
                'PayPerHour',
            ]);
        });
    });
});
