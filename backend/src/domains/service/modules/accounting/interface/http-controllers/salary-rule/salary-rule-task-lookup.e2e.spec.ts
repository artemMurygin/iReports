import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    SalaryAccrualLineSummary,
    SalaryRuleDetail,
    SalaryRuleSummary,
} from 'ireports-contracts';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { GetSalaryRuleHttpController } from './get-salary-rule.http.controller';
import { GetSalaryRuleByTaskHttpController } from './get-salary-rule-by-task.http.controller';
import { GetSalaryAccrualLineByTaskHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/salary-accrual/get-salary-accrual-line-by-task.http.controller';
import { GetSalaryRuleService } from '@/domains/service/modules/accounting/application/services/task-completion/get-salary-rule.service';
import { FindSalaryRuleForTaskService } from '@/domains/service/modules/accounting/application/services/task-completion/find-salary-rule-for-task.service';
import { FindSalaryAccrualForTaskService } from '@/domains/service/modules/accounting/application/services/task-completion/find-salary-accrual-for-task.service';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — HTTP-слой
// поверх уже реализованных (разделы 15-18) FindSalaryRuleForTaskService/
// FindSalaryAccrualForTaskService/GetSalaryRuleService. Изолированный e2e
// (только эти 3 контроллера + фейки их прямых application-сервисов, не всё
// AccountingModule целиком, как у соседних *.e2e.spec.ts в этом модуле) —
// достаточно, т.к. контроллеры не содержат собственной логики, кроме
// делегирования и передачи route-параметра, а найденные ранее
// application-сервисы уже покрыты юнит-тестами разделов 15-18. Здесь
// проверяется именно HTTP-слой: маппинг маршрута/параметра и то, что
// SalaryRuleNotFoundException реально долетает до клиента как 404 (см.
// SALARY_RULE_NOT_FOUND в domain-exception.filter.ts).
describe('Salary rule / accrual line — HTTP lookup by id / by taskId (service, e2e)', () => {
    let app: INestApplication<Server>;

    const ruleDetail = {
        id: 'rule-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'ENGINEER',
        direction: 'service',
        config: { taskIdByPeriod: {} },
        motivationSchemaName: 'Инженеры',
    } as SalaryRuleDetail;
    const ruleSummary: SalaryRuleSummary = {
        id: 'rule-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'ENGINEER',
    };
    const accrualLineSummary: SalaryAccrualLineSummary = {
        id: 'line-1',
        amount: 1500,
        status: 'ACCRUED',
    };

    const executeGetSalaryRule = jest.fn((ruleId: string) => {
        if (ruleId !== 'rule-1') {
            return Promise.reject(new SalaryRuleNotFoundException(ruleId));
        }
        return Promise.resolve(ruleDetail);
    });
    const fakeGetSalaryRule = {
        execute: executeGetSalaryRule,
    } as unknown as GetSalaryRuleService;

    const executeFindSalaryRuleForTask = jest.fn((taskId: string) =>
        Promise.resolve(taskId === 'task-1' ? ruleSummary : null),
    );
    const fakeFindSalaryRuleForTask = {
        execute: executeFindSalaryRuleForTask,
    } as unknown as FindSalaryRuleForTaskService;

    const executeFindSalaryAccrualForTask = jest.fn((taskId: string) =>
        Promise.resolve(taskId === 'task-1' ? accrualLineSummary : null),
    );
    const fakeFindSalaryAccrualForTask = {
        execute: executeFindSalaryAccrualForTask,
    } as unknown as FindSalaryAccrualForTaskService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [
                GetSalaryRuleHttpController,
                GetSalaryRuleByTaskHttpController,
                GetSalaryAccrualLineByTaskHttpController,
            ],
            providers: [
                { provide: GetSalaryRuleService, useValue: fakeGetSalaryRule },
                {
                    provide: FindSalaryRuleForTaskService,
                    useValue: fakeFindSalaryRuleForTask,
                },
                {
                    provide: FindSalaryAccrualForTaskService,
                    useValue: fakeFindSalaryAccrualForTask,
                },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /v1/service/accounting/salary-rules/:ruleId — 200 с SalaryRuleDetail для существующего правила', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary-rules/rule-1')
            .expect(200);
        expect(response.body).toEqual(ruleDetail);
        expect(executeGetSalaryRule).toHaveBeenCalledWith('rule-1');
    });

    it('GET /v1/service/accounting/salary-rules/:ruleId — 404 для несуществующего правила', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/accounting/salary-rules/missing')
            .expect(404);
    });

    it('GET /v1/service/accounting/salary-rules/by-task/:taskId — 200 с SalaryRuleSummary, когда правило ссылается на задачу', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary-rules/by-task/task-1')
            .expect(200);
        expect(response.body).toEqual(ruleSummary);
        expect(executeFindSalaryRuleForTask).toHaveBeenCalledWith('task-1');
    });

    it('GET /v1/service/accounting/salary-rules/by-task/:taskId — 200 с null, когда ни одно правило не ссылается на задачу', async () => {
        const response = await request(app.getHttpServer())
            .get(
                '/v1/service/accounting/salary-rules/by-task/task-without-rule',
            )
            .expect(200);
        expect(response.body).toBeNull();
    });

    it('GET /v1/service/accounting/salary-accrual-lines/by-task/:taskId — 200 с SalaryAccrualLineSummary, когда строка отображается', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary-accrual-lines/by-task/task-1')
            .expect(200);
        expect(response.body).toEqual(accrualLineSummary);
        expect(executeFindSalaryAccrualForTask).toHaveBeenCalledWith('task-1');
    });

    it('GET /v1/service/accounting/salary-accrual-lines/by-task/:taskId — 200 с null, когда строка ещё не отображается', async () => {
        const response = await request(app.getHttpServer())
            .get(
                '/v1/service/accounting/salary-accrual-lines/by-task/task-without-line',
            )
            .expect(200);
        expect(response.body).toBeNull();
    });
});
