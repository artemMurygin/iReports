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
import { GetShopSalaryRuleHttpController } from './get-salary-rule.http.controller';
import { GetShopSalaryRuleByTaskHttpController } from './get-salary-rule-by-task.http.controller';
import { GetShopSalaryAccrualLineByTaskHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/get-salary-accrual-line-by-task.http.controller';
import { GetSalaryRuleService } from '@/domains/shop/modules/accounting/application/services/salary-task/get-salary-rule.service';
import { FindSalaryRuleForTaskService } from '@/domains/shop/modules/accounting/application/services/salary-task/find-salary-rule-for-task.service';
import { FindSalaryAccrualForTaskService } from '@/domains/shop/modules/accounting/application/services/salary-task/find-salary-accrual-for-task.service';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../salary-rule/salary-rule-task-lookup.e2e.spec.ts (см.
// WHY там): изолированный e2e только этих 3 контроллеров направления shop
// + фейки их прямых application-сервисов (разделы 15-18, уже покрыты
// юнит-тестами), а не ShopAccountingModule целиком.
describe('Salary rule / accrual line — HTTP lookup by id / by taskId (shop, e2e)', () => {
    let app: INestApplication<Server>;

    const ruleDetail = {
        id: 'rule-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'ONLINE_MANAGER',
        direction: 'shop',
        config: { taskIdByPeriod: {} },
        motivationSchemaName: 'Продавцы',
    } as SalaryRuleDetail;
    const ruleSummary: SalaryRuleSummary = {
        id: 'rule-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'ONLINE_MANAGER',
    };
    const accrualLineSummary: SalaryAccrualLineSummary = {
        id: 'line-1',
        amount: 2500,
        status: 'ACCRUED',
    };

    const executeGetSalaryRule = jest.fn((ruleId: string) => {
        if (ruleId !== 'rule-1') {
            return Promise.reject(new ShopSalaryRuleNotFoundException(ruleId));
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
                GetShopSalaryRuleHttpController,
                GetShopSalaryRuleByTaskHttpController,
                GetShopSalaryAccrualLineByTaskHttpController,
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

    it('GET /v1/shop/accounting/salary-rules/:ruleId — 200 с SalaryRuleDetail для существующего правила', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary-rules/rule-1')
            .expect(200);
        expect(response.body).toEqual(ruleDetail);
        expect(executeGetSalaryRule).toHaveBeenCalledWith('rule-1');
    });

    it('GET /v1/shop/accounting/salary-rules/:ruleId — 404 для несуществующего правила', async () => {
        await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary-rules/missing')
            .expect(404);
    });

    it('GET /v1/shop/accounting/salary-rules/by-task/:taskId — 200 с SalaryRuleSummary, когда правило ссылается на задачу', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary-rules/by-task/task-1')
            .expect(200);
        expect(response.body).toEqual(ruleSummary);
        expect(executeFindSalaryRuleForTask).toHaveBeenCalledWith('task-1');
    });

    it('GET /v1/shop/accounting/salary-rules/by-task/:taskId — 200 с null, когда ни одно правило не ссылается на задачу', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary-rules/by-task/task-without-rule')
            .expect(200);
        expect(response.body).toBeNull();
    });

    it('GET /v1/shop/accounting/salary-accrual-lines/by-task/:taskId — 200 с SalaryAccrualLineSummary, когда строка отображается', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary-accrual-lines/by-task/task-1')
            .expect(200);
        expect(response.body).toEqual(accrualLineSummary);
        expect(executeFindSalaryAccrualForTask).toHaveBeenCalledWith('task-1');
    });

    it('GET /v1/shop/accounting/salary-accrual-lines/by-task/:taskId — 200 с null, когда строка ещё не отображается', async () => {
        const response = await request(app.getHttpServer())
            .get(
                '/v1/shop/accounting/salary-accrual-lines/by-task/task-without-line',
            )
            .expect(200);
        expect(response.body).toBeNull();
    });
});
