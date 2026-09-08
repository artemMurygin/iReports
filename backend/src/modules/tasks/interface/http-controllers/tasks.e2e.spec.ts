import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { CreateTaskResponse, Task } from 'ireports-contracts';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';

// specs/tasks/spec.md — сквозной сценарий HTTP-слоя src/modules/tasks:
// create → get → list с фильтром → transition через полный граф статусов
// → transition из терминального статуса отклоняется 4xx. Реальные
// Controller → CommandBus/Service → Entity/VO, подменена только граница с
// БД (in-memory), тем же приёмом, что work-schedule.e2e.spec.ts/
// balance-transactions.e2e.spec.ts. Без RBAC-гардов (tasks.md, "Решения,
// зафиксированные перед написанием этого списка") — TasksModule
// контроллеры не несут @UseGuards, а APP_GUARD регистрируется только в
// AppModule (не в этом изолированном TestingModule), поэтому PATCH .../status
// нуждается в request.user — здесь его заполняет тестовая мидлварь ниже
// (в проде это делает глобальный SessionAuthGuard).
describe('Tasks HTTP (e2e)', () => {
    let app: INestApplication<Server>;
    const taskRepo = new InMemoryTaskRepository();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [TasksModule],
        })
            .overrideProvider(TASK_REPOSITORY)
            .useValue(taskRepo)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        // Тестовая замена SessionAuthGuard (см. WHY в шапке файла).
        app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
            req.user = { employeeId: 42, permissions: [] };
            next();
        });
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        taskRepo.store.clear();
    });

    it('create → get → list с фильтром → transition через полный граф → отказ из терминального статуса', async () => {
        // create
        const createResponse = await request(app.getHttpServer())
            .post('/v1/tasks')
            .send({
                title: 'Сдать отчёт',
                description: 'Проверить цифры',
                deadline: '2026-09-30T00:00:00.000Z',
                assigneeEmployeeId: 42,
                direction: 'service',
            })
            .expect(201);
        const { id } = createResponse.body as CreateTaskResponse;
        expect(id).toEqual(expect.any(String));

        // get
        const getResponse = await request(app.getHttpServer())
            .get(`/v1/tasks/${id}`)
            .expect(200);
        const created = getResponse.body as Task;
        expect(created).toMatchObject({
            id,
            title: 'Сдать отчёт',
            description: 'Проверить цифры',
            assigneeEmployeeId: 42,
            direction: 'service',
            status: 'NEW',
            closedSuccessfullyAt: null,
        });

        // list — без фильтра видна сразу после создания (specs/tasks/spec.md,
        // «Задача видна в интерфейсе на любой стадии жизненного цикла»).
        const listAll = await request(app.getHttpServer())
            .get('/v1/tasks')
            .expect(200);
        expect((listAll.body as Task[]).some((task) => task.id === id)).toBe(
            true,
        );

        // list с фильтром по статусу — задача видна под NEW, не видна под
        // IN_PROGRESS.
        const listNew = await request(app.getHttpServer())
            .get('/v1/tasks')
            .query({ status: 'NEW' })
            .expect(200);
        expect((listNew.body as Task[]).map((t) => t.id)).toContain(id);
        const listInProgress = await request(app.getHttpServer())
            .get('/v1/tasks')
            .query({ status: 'IN_PROGRESS' })
            .expect(200);
        expect((listInProgress.body as Task[]).map((t) => t.id)).not.toContain(
            id,
        );

        // transition: NEW → IN_PROGRESS → DONE → CLOSED_SUCCESSFULLY (полный
        // граф self-service до успешного закрытия).
        const toInProgress = await request(app.getHttpServer())
            .patch(`/v1/tasks/${id}/status`)
            .send({ targetStatus: 'IN_PROGRESS' })
            .expect(200);
        expect((toInProgress.body as Task).status).toBe('IN_PROGRESS');

        const toDone = await request(app.getHttpServer())
            .patch(`/v1/tasks/${id}/status`)
            .send({ targetStatus: 'DONE' })
            .expect(200);
        expect((toDone.body as Task).status).toBe('DONE');

        const toClosed = await request(app.getHttpServer())
            .patch(`/v1/tasks/${id}/status`)
            .send({ targetStatus: 'CLOSED_SUCCESSFULLY' })
            .expect(200);
        const closed = toClosed.body as Task;
        expect(closed.status).toBe('CLOSED_SUCCESSFULLY');
        expect(closed.closedSuccessfullyAt).not.toBeNull();

        // transition из терминального статуса — отклоняется 4xx (409,
        // InvalidTaskTransitionException → CONFLICT), статус не меняется.
        await request(app.getHttpServer())
            .patch(`/v1/tasks/${id}/status`)
            .send({ targetStatus: 'IN_PROGRESS' })
            .expect(409);
        const afterRejected = await request(app.getHttpServer())
            .get(`/v1/tasks/${id}`)
            .expect(200);
        expect((afterRejected.body as Task).status).toBe('CLOSED_SUCCESSFULLY');
    });

    it('DONE → CLOSED_UNSUCCESSFULLY / DONE → REWORK → IN_PROGRESS — остальные ветви графа проверки руководителем', async () => {
        const create = await request(app.getHttpServer())
            .post('/v1/tasks')
            .send({
                title: 'Задача 2',
                deadline: '2026-09-30T00:00:00.000Z',
                assigneeEmployeeId: 7,
            })
            .expect(201);
        const rejectedId = (create.body as CreateTaskResponse).id;
        await request(app.getHttpServer())
            .patch(`/v1/tasks/${rejectedId}/status`)
            .send({ targetStatus: 'IN_PROGRESS' })
            .expect(200);
        await request(app.getHttpServer())
            .patch(`/v1/tasks/${rejectedId}/status`)
            .send({ targetStatus: 'DONE' })
            .expect(200);
        const rejected = await request(app.getHttpServer())
            .patch(`/v1/tasks/${rejectedId}/status`)
            .send({ targetStatus: 'CLOSED_UNSUCCESSFULLY' })
            .expect(200);
        expect((rejected.body as Task).status).toBe('CLOSED_UNSUCCESSFULLY');
        expect((rejected.body as Task).closedSuccessfullyAt).toBeNull();

        const create2 = await request(app.getHttpServer())
            .post('/v1/tasks')
            .send({
                title: 'Задача 3',
                deadline: '2026-09-30T00:00:00.000Z',
                assigneeEmployeeId: 7,
            })
            .expect(201);
        const reworkId = (create2.body as CreateTaskResponse).id;
        await request(app.getHttpServer())
            .patch(`/v1/tasks/${reworkId}/status`)
            .send({ targetStatus: 'IN_PROGRESS' })
            .expect(200);
        await request(app.getHttpServer())
            .patch(`/v1/tasks/${reworkId}/status`)
            .send({ targetStatus: 'DONE' })
            .expect(200);
        const rework = await request(app.getHttpServer())
            .patch(`/v1/tasks/${reworkId}/status`)
            .send({ targetStatus: 'REWORK' })
            .expect(200);
        expect((rework.body as Task).status).toBe('REWORK');
        const backToProgress = await request(app.getHttpServer())
            .patch(`/v1/tasks/${reworkId}/status`)
            .send({ targetStatus: 'IN_PROGRESS' })
            .expect(200);
        expect((backToProgress.body as Task).status).toBe('IN_PROGRESS');
    });

    it('недопустимый переход прямо из NEW в CLOSED_SUCCESSFULLY — 409, задача не меняется', async () => {
        const create = await request(app.getHttpServer())
            .post('/v1/tasks')
            .send({
                title: 'Задача 4',
                deadline: '2026-09-30T00:00:00.000Z',
                assigneeEmployeeId: 7,
            })
            .expect(201);
        const id = (create.body as CreateTaskResponse).id;

        await request(app.getHttpServer())
            .patch(`/v1/tasks/${id}/status`)
            .send({ targetStatus: 'CLOSED_SUCCESSFULLY' })
            .expect(409);

        const after = await request(app.getHttpServer())
            .get(`/v1/tasks/${id}`)
            .expect(200);
        expect((after.body as Task).status).toBe('NEW');
    });

    it('GET несуществующей задачи — 404', async () => {
        await request(app.getHttpServer())
            .get('/v1/tasks/missing-id')
            .expect(404);
    });

    it('POST с пустым title отклоняется 400 (валидация contract)', async () => {
        await request(app.getHttpServer())
            .post('/v1/tasks')
            .send({
                title: '',
                deadline: '2026-09-30T00:00:00.000Z',
                assigneeEmployeeId: 7,
            })
            .expect(400);
    });
});
