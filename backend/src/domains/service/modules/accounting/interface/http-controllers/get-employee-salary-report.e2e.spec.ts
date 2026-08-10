import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Настоящей инфраструктуры для test:e2e (jest-e2e.json + отдельная БД) в
// проекте пока нет (см. backend/CLAUDE.md — упомянутый конфиг не заведён).
// Этот тест — ближайший к нему эквивалент, который реально выполняется в
// npm run test: поднимает AccountingModule целиком через Nest TestingModule
// (реальные Controller → Service → Orchestrator → Entity), подменяя только
// границу с БД — репозиторий мотивационной схемы — на in-memory реализацию.
describe('GET /accounting/salary_report/employee/:id/:period (e2e)', () => {
    let app: INestApplication;
    const schemas = new Map<number, MotivationSchema>();

    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: (entity) => {
            schemas.set(entity.getProps().targetId, entity);
            return Promise.resolve();
        },
        findByEmployee: (employeeId) =>
            Promise.resolve(schemas.get(employeeId) ?? null),
    };
    const fakeSalaryRuleRepo: SalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
    };
    // AccountingModule заодно поднимает CreateMotivationSchemaHandler (не
    // используется этим эндпоинтом), которому нужен UNIT_OF_WORK — реальный
    // PrismaUnitOfWork приходит из @Global() DatabaseModule (требует живой
    // Postgres). overrideProvider() не годится: он лишь подменяет уже
    // объявленный в графе модулей провайдер, а этот здесь никем не
    // объявлен — поэтому регистрируем его сами тем же способом
    // (@Global()-модуль), каким это в реальном приложении делает
    // DatabaseModule.
    const fakeUnitOfWork: UnitOfWorkPort = {
        run: (work) => work(),
    };

    @Global()
    @Module({
        providers: [{ provide: UNIT_OF_WORK, useValue: fakeUnitOfWork }],
        exports: [UNIT_OF_WORK],
    })
    class FakeUnitOfWorkModule {}

    beforeAll(async () => {
        const schema = withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { hours: 8, price: 250 },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });
        schemas.set(42, schema);

        const moduleRef = await Test.createTestingModule({
            imports: [FakeUnitOfWorkModule, AccountingModule],
        })
            .overrideProvider(MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeMotivationSchemaRepo)
            .overrideProvider(SALARY_RULE_REPOSITORY)
            .useValue(fakeSalaryRuleRepo)
            .compile();

        app = moduleRef.createNestApplication();
        // Доменные исключения (ArgumentInvalidException и т.п.) читают
        // RequestContext в конструкторе (см. ExceptionBase) — в реальном
        // приложении его открывает RequestContextMiddleware, подключённый в
        // AppModule.configure(); здесь бутстрапится только AccountingModule,
        // поэтому подключаем ту же middleware вручную.
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req as never, res as never, next),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('возвращает итог и разбивку по правилам схемы сотрудника', async () => {
        const response = await request(app.getHttpServer())
            .get('/accounting/salary_report/employee/42/2026-08')
            .expect(200);
        const body = response.body as EmployeeSalaryReportResponse;

        expect(body).toMatchObject({
            period: '2026-08',
            isClosed: false,
            grandTotal: { fact: 2000, prognose: 2000 },
        });
        expect(body.directions).toHaveLength(1);
        expect(body.directions[0]).toMatchObject({
            direction: 'service',
            total: { fact: 2000, prognose: 2000 },
            isPlanApproved: true,
        });
        expect(body.directions[0].rules).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                amount: { fact: 2000, prognose: 2000 },
            }),
        ]);
    });

    it('возвращает пустой отчёт для сотрудника без мотивационной схемы', async () => {
        const response = await request(app.getHttpServer())
            .get('/accounting/salary_report/employee/999/2026-08')
            .expect(200);
        const body = response.body as EmployeeSalaryReportResponse;

        expect(body).toMatchObject({
            grandTotal: { fact: 0, prognose: 0 },
        });
        expect(body.directions[0].rules).toEqual([]);
    });

    it('отклоняет период не в формате YYYY-MM', async () => {
        await request(app.getHttpServer())
            .get('/accounting/salary_report/employee/42/2026')
            .expect(400);
    });
});
