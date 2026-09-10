import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    CreateTaskResponse,
    EmployeeSalaryReportResponse,
    Task,
} from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { Period } from '@/shared/domain/period.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// tasks.md, группа 16 (задача 16.3) — сквозной сценарий поверх РЕАЛЬНОГО
// HTTP-слоя src/modules/tasks (без мока /v1/tasks, только граница с БД
// подменена на InMemoryTaskRepository — тот же приём, что и
// tasks.e2e.spec.ts): create task → правило TaskCompletion со ссылкой на
// неё → NEW→IN_PROGRESS→DONE→CLOSED_SUCCESSFULLY → строка начисления
// появляется в отчёте сотрудника ТОЛЬКО на последнем переходе (spec:
// service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения)
// → открытие отчёта за новый период автосоздаёт задачу регулярного
// правила (EnsureRuleTaskForPeriodService) и она видна в /tasks.
//
// Схема мотивации сама (MotivationSchema+TaskCompletion) заводится напрямую
// через доменные фабрики в beforeAll — тем же приёмом, что и
// get-employee-salary-report.e2e.spec.ts (PayPerHoursEntity.create()) — а
// не через полный HTTP-мастер POST /v1/service/motivation-schema: этот
// тест целится в ЖИЗНЕННЫЙ ЦИКЛ ЗАДАЧИ и его влияние на отчёт (то, что не
// покрыто ни tasks.e2e.spec.ts, ни get-employee-salary-report.e2e.spec.ts
// по отдельности), а не в CQRS-цепочку создания схемы/правила — та уже
// покрыта create-salary-rule.handler.spec.ts и соседними юнит-тестами.
describe('Жизненный цикл задачи TaskCompletion и её видимость в отчёте (e2e)', () => {
    let app: INestApplication<Server>;
    const employeeId = 777;
    const taskRepo = new InMemoryTaskRepository();
    const schemas = new Map<number, MotivationSchema>();
    let rule: TaskCompletion;
    let initialTaskId: string;

    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: (entity) => {
            schemas.set(entity.getProps().target.getId(), entity);
            return Promise.resolve();
        },
        findByEmployee: (id) => Promise.resolve(schemas.get(id) ?? null),
        findByEmployees: (ids) =>
            Promise.resolve(
                ids
                    .map((id) => schemas.get(id))
                    .filter((s): s is MotivationSchema => !!s),
            ),
        findAllEmployeeTargets: () =>
            Promise.resolve(
                Array.from(schemas.values()).filter((s) =>
                    s.getProps().target.isEmployee(),
                ),
            ),
        findByDepartment: () => Promise.resolve(null),
        findAllDepartmentTargets: () => Promise.resolve([]),
        findIdByTarget: () => Promise.resolve(null),
        findById: () => Promise.resolve(null),
        findAll: () => Promise.resolve([]),
        update: () => Promise.resolve(),
        initializeName: () => Promise.resolve(),
    };
    const fakeSalaryRuleRepo: SalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
        deleteByIds: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        // EnsureRuleTaskForPeriodService мутирует rule.config напрямую и
        // персистит через update() — здесь достаточно no-op: fakeMotivationSchemaRepo
        // хранит ТОТ ЖЕ объект правила (mergeEmployeeSalaryRules не клонирует),
        // поэтому мутация видна следующему чтению схемы без реальной записи.
        update: () => Promise.resolve(),
    };
    const fakeAccountingPeriodRepo: AccountingPeriodRepositoryPort = {
        findByDirectionAndPeriod: () => Promise.resolve(null),
        save: () => Promise.resolve(),
    };
    const fakeAccountingPeriodSnapshot: AccountingPeriodSnapshotPort = {
        saveAll: () => Promise.resolve(),
        findByKey: () => Promise.resolve(null),
        findManyByKey: () => Promise.resolve(new Map()),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    // find() всегда null — расчёт открытого периода никогда не читает из
    // кэша в этом тесте (пишет исправно, но следующий вызов пересчитывает
    // заново), поэтому переход статуса задачи между вызовами GET не может
    // потеряться за счёт устаревшего freshnessStamp.
    const fakeAccountingCalculationCache: AccountingCalculationCachePort = {
        find: () => Promise.resolve(null),
        upsert: () => Promise.resolve(),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    const fakeDomainSyncStatus: DomainSyncStatusPort = {
        getLastSuccessfulSyncAt: () => Promise.resolve(null),
        markSuccessful: () => Promise.resolve(),
    };
    const fakeSalesPlanRepo: SalesPlanRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByIds: () => Promise.resolve([]),
        findByScope: () => Promise.resolve(null),
        findByDirectionAndPeriod: () => Promise.resolve([]),
    };
    const fakeServiceCalculationData: ServiceCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findServiceCompletedItems: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve({ fact: 0, prognose: 0 }),
        findOrderPayedItems: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    // См. WHY у одноимённого блока в get-employee-salary-report.e2e.spec.ts —
    // AccountingModule конструирует провайдеров, которым нужен реальный
    // UNIT_OF_WORK/DatabaseService (DatabaseModule, @Global), даже когда
    // этот тест их не использует.
    const fakeUnitOfWork: UnitOfWorkPort = { run: (work) => work() };
    const fakeDatabaseService = {} as unknown as DatabaseService;

    @Global()
    @Module({
        providers: [
            { provide: UNIT_OF_WORK, useValue: fakeUnitOfWork },
            { provide: DatabaseService, useValue: fakeDatabaseService },
        ],
        exports: [UNIT_OF_WORK, DatabaseService],
    })
    class FakeInfrastructureModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                EventEmitterModule.forRoot(),
                FakeInfrastructureModule,
                AccountingModule,
            ],
        })
            .overrideProvider(MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeMotivationSchemaRepo)
            .overrideProvider(SALARY_RULE_REPOSITORY)
            .useValue(fakeSalaryRuleRepo)
            .overrideProvider(ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeAccountingPeriodRepo)
            .overrideProvider(ACCOUNTING_PERIOD_SNAPSHOT)
            .useValue(fakeAccountingPeriodSnapshot)
            .overrideProvider(ACCOUNTING_CALCULATION_CACHE)
            .useValue(fakeAccountingCalculationCache)
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SALES_PLAN_REPOSITORY)
            .useValue(fakeSalesPlanRepo)
            .overrideProvider(SERVICE_CALCULATION_DATA)
            .useValue(fakeServiceCalculationData)
            .overrideProvider(TASK_REPOSITORY)
            .useValue(taskRepo)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        // Тестовая замена SessionAuthGuard — см. WHY в tasks.e2e.spec.ts
        // (TasksModule не несёт @UseGuards, APP_GUARD не зарегистрирован в
        // этом изолированном TestingModule).
        app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
            req.user = { employeeId, permissions: [] };
            next();
        });
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();

        // Шаг 1 мастера: задача создаётся ОТДЕЛЬНЫМ, предшествующим
        // запросом (design.md решение 4, см. WHY в task-completion.entity.ts) —
        // через реальный POST /v1/tasks, не мок.
        const createTaskResponse = await request(app.getHttpServer())
            .post('/v1/tasks')
            .send({
                title: 'Сдать ежемесячный отчёт по инвентаризации',
                description: 'Сверить остатки на складе',
                deadline: '2026-09-30T00:00:00.000Z',
                assigneeEmployeeId: employeeId,
                direction: 'service',
            })
            .expect(201);
        initialTaskId = (createTaskResponse.body as CreateTaskResponse).id;

        // Регулярное правило TaskCompletion на ЛИЧНОЙ схеме сотрудника,
        // config.taskId ссылается на уже созданную задачу — тот же путь,
        // которым TaskCompletion.create() строит config из
        // TaskCompletionSalaryConfigRequest (buildTaskCompletionConfig
        // кладёт taskId в taskIdByPeriod[Period.current()]).
        rule = withRequestContext(() =>
            TaskCompletion.create({
                type: 'TaskCompletion',
                name: 'Премия за инвентаризацию',
                targetRole: 'ENGINEER',
                config: {
                    taskId: initialTaskId,
                    taskTitleTemplate: 'Сдать ежемесячный отчёт по инвентаризации',
                    taskDescriptionTemplate: 'Сверить остатки на складе',
                    isRecurring: true,
                    deadlineTemplate: '2026-09-30',
                    defaultAmount: 1500,
                },
            }),
        ) as TaskCompletion;
        const schema = withRequestContext(() =>
            MotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Мотивация инженера',
                rules: [rule],
            }),
        );
        schemas.set(employeeId, schema);
    });

    afterAll(async () => {
        await app.close();
    });

    const currentPeriod = Period.current().getValue();

    async function getEmployeeReport(
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const response = await request(app.getHttpServer())
            .get(`/v1/service/accounting/salary_report/employee/${employeeId}/${period}`)
            .expect(200);
        return response.body as EmployeeSalaryReportResponse;
    }

    function findTaskCompletionRule(report: EmployeeSalaryReportResponse) {
        return report.rules.find((r) => r.type === 'TaskCompletion');
    }

    it('строка TaskCompletion не видна в отчёте, пока задача не выполнена (NEW)', async () => {
        const report = await getEmployeeReport(currentPeriod);
        expect(findTaskCompletionRule(report)).toBeUndefined();
    });

    it('NEW → IN_PROGRESS (ответственный) — строка всё ещё не видна', async () => {
        const toInProgress = await request(app.getHttpServer())
            .patch(`/v1/tasks/${initialTaskId}/status`)
            .send({ targetStatus: 'IN_PROGRESS' })
            .expect(200);
        expect((toInProgress.body as Task).status).toBe('IN_PROGRESS');

        const report = await getEmployeeReport(currentPeriod);
        expect(findTaskCompletionRule(report)).toBeUndefined();
    });

    it('IN_PROGRESS → DONE (ответственный) — строка ещё не видна: DONE ≠ выполнено для целей начисления', async () => {
        const toDone = await request(app.getHttpServer())
            .patch(`/v1/tasks/${initialTaskId}/status`)
            .send({ targetStatus: 'DONE' })
            .expect(200);
        expect((toDone.body as Task).status).toBe('DONE');

        const report = await getEmployeeReport(currentPeriod);
        expect(findTaskCompletionRule(report)).toBeUndefined();
    });

    it('DONE → CLOSED_SUCCESSFULLY (руководитель) — строка появляется только теперь', async () => {
        const toClosed = await request(app.getHttpServer())
            .patch(`/v1/tasks/${initialTaskId}/status`)
            .send({ targetStatus: 'CLOSED_SUCCESSFULLY' })
            .expect(200);
        expect((toClosed.body as Task).status).toBe('CLOSED_SUCCESSFULLY');

        const report = await getEmployeeReport(currentPeriod);
        const line = findTaskCompletionRule(report);
        expect(line).toMatchObject({
            type: 'TaskCompletion',
            name: 'Премия за инвентаризацию',
            amount: { fact: 1500, prognose: 1500 },
            sources: [
                expect.objectContaining({
                    type: 'taskCompletion',
                    id: initialTaskId,
                }),
            ],
        });
    });

    it('открытие отчёта за новый период автосоздаёт задачу регулярного правила — видна в /tasks', async () => {
        // Period не несёт .next() (только .previous()) — считаем следующий
        // месяц напрямую, тем же UTC-трюком, что и Period.previous().
        const [year, month] = currentPeriod.split('-').map(Number);
        const nextMonthDate = new Date(Date.UTC(year, month, 1));
        const nextPeriod = Period.create(
            `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}`,
        ).getValue();
        expect(rule.config.taskIdByPeriod[nextPeriod]).toBeUndefined();

        // GetEmployeeSalaryReportService.buildOpenServiceDirection →
        // ensureTaskCompletionTasks → EnsureRuleTaskForPeriodService.ensure()
        // — единственный триггер (см. WHY в самом сервисе).
        await getEmployeeReport(nextPeriod);

        const newTaskId = rule.config.taskIdByPeriod[nextPeriod];
        expect(newTaskId).toEqual(expect.any(String));
        expect(newTaskId).not.toBe(initialTaskId);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/tasks')
            .expect(200);
        const tasks = listResponse.body as Task[];
        expect(tasks.map((t) => t.id)).toEqual(
            expect.arrayContaining([initialTaskId, newTaskId]),
        );
        const newTask = tasks.find((t) => t.id === newTaskId);
        expect(newTask).toMatchObject({
            status: 'NEW',
            assigneeEmployeeId: employeeId,
            title: 'Сдать ежемесячный отчёт по инвентаризации',
        });

        // Новая строка правила за новый период ещё не видна — новая задача
        // только что заведена в NEW, не выполнена (тот же инвариант, что и
        // в первом тесте этого файла).
        const reportForNextPeriod = await getEmployeeReport(nextPeriod);
        expect(findTaskCompletionRule(reportForNextPeriod)).toBeUndefined();
    });
});
