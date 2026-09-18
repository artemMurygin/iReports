import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { TaskComment, TaskLink } from 'ireports-contracts';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import { TASK_COMMENT_REPOSITORY } from '@/modules/tasks/application/ports/task-comment.repository.port';
import { TASK_LINK_REPOSITORY } from '@/modules/tasks/application/ports/task-link.repository.port';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { InMemoryTaskCommentRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-comment.repository';
import { InMemoryTaskLinkRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-link.repository';
import { SessionService } from '@/modules/session/infrastructure/session.service';
import { ApiKeyRepository } from '@/modules/session/infrastructure/api-key.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';

// tasks.md, группы 13-14 — e2e/controller-тесты HTTP-слоя комментариев/
// ссылок задачи. Реальные Controller → CommandBus/Service → Entity/VO,
// подменена только граница с БД (in-memory), тот же приём, что
// tasks.e2e.spec.ts. TasksModule теперь несёт @UseGuards
// (tasks:view/comment/manage_links) — SessionService подменяется фейком
// (см. tasks.e2e.spec.ts), автор комментария ОБЯЗАТЕЛЬНО берётся из
// request.user, заполненного этим фейком, не из тела запроса (spec:
// tasks/comments#Requirement: Комментарий фиксирует автора, время и текст).
describe('Task comments/links HTTP (e2e)', () => {
    let app: INestApplication<Server>;
    const commentRepo = new InMemoryTaskCommentRepository();
    const linkRepo = new InMemoryTaskLinkRepository();
    const taskId = 'task-1';

    const validateSessionAndTouch = jest.fn().mockResolvedValue({
        bitrixEmployeeId: 42,
        permissions: ['tasks:view', 'tasks:comment', 'tasks:manage_links'],
    });
    const fakeSessionService: Partial<SessionService> = {
        validateSessionAndTouch,
    };
    const fakeApiKeyRepository: Partial<ApiKeyRepository> = {
        findActiveEmployeeByApiKeyHash: jest.fn(),
    };

    const AUTH_HEADER = ['Authorization', 'Bearer test-session'] as const;
    const authedRequest = () => request(app.getHttpServer());

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [TasksModule],
        })
            .overrideProvider(TASK_REPOSITORY)
            .useValue(new InMemoryTaskRepository())
            .overrideProvider(TASK_COMMENT_REPOSITORY)
            .useValue(commentRepo)
            .overrideProvider(TASK_LINK_REPOSITORY)
            .useValue(linkRepo)
            .overrideProvider(SessionService)
            .useValue(fakeSessionService)
            .overrideProvider(ApiKeyRepository)
            .useValue(fakeApiKeyRepository)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        commentRepo.store.clear();
        linkRepo.store.clear();
    });

    describe('Комментарии', () => {
        it('GET список пуст для задачи без комментариев (spec: tasks/comments#Requirement: Задача без комментариев не показывает список комментариев)', async () => {
            const response = await authedRequest()
                .get(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .expect(200);
            expect(response.body).toEqual([]);
        });

        it('POST с непустым текстом создаёт комментарий, автор — из req.user.employeeId, не из тела запроса', async () => {
            const createResponse = await authedRequest()
                .post(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .send({ text: 'Готово, проверьте', authorEmployeeId: 999 })
                .expect(201);
            const created = createResponse.body as TaskComment;
            expect(created).toMatchObject({
                taskId,
                text: 'Готово, проверьте',
                authorEmployeeId: 42,
            });
            expect(created.authorEmployeeId).not.toBe(999);
            expect(created.id).toEqual(expect.any(String));

            const listResponse = await authedRequest()
                .get(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .expect(200);
            expect(
                (listResponse.body as TaskComment[]).map((c) => c.id),
            ).toContain(created.id);
        });

        it('второй комментарий добавляется последним в хронологическом списке, прежний не теряется (spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и текст)', async () => {
            await authedRequest()
                .post(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .send({ text: 'Первый' })
                .expect(201);
            await authedRequest()
                .post(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .send({ text: 'Второй' })
                .expect(201);

            const listResponse = await authedRequest()
                .get(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .expect(200);
            const texts = (listResponse.body as TaskComment[]).map(
                (c) => c.text,
            );
            expect(texts).toEqual(['Первый', 'Второй']);
        });

        it('POST с пустым текстом отклоняется 4xx (spec: tasks/comments#Requirement: Пустой комментарий отклоняется)', async () => {
            const res = await authedRequest()
                .post(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .send({ text: '' });
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('POST с текстом из одних пробелов отклоняется 4xx (spec: tasks/comments#Requirement: Пустой комментарий отклоняется)', async () => {
            const res = await authedRequest()
                .post(`/v1/tasks/${taskId}/comments`)
                .set(...AUTH_HEADER)
                .send({ text: '   ' });
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });

    describe('Ссылки', () => {
        it('GET список пуст для задачи без ссылок (spec: tasks/links#Requirement: Задача может иметь несколько ссылок)', async () => {
            const response = await authedRequest()
                .get(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .expect(200);
            expect(response.body).toEqual([]);
        });

        it('POST с валидным URL создаёт ссылку, ранее добавленные не теряются', async () => {
            const first = await authedRequest()
                .post(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .send({ url: 'https://example.com/report.pdf', label: 'Отчёт' })
                .expect(201);
            const firstLink = first.body as TaskLink;
            expect(firstLink).toMatchObject({
                taskId,
                url: 'https://example.com/report.pdf',
                label: 'Отчёт',
            });

            const second = await authedRequest()
                .post(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .send({ url: 'https://example.com/second' })
                .expect(201);
            const secondLink = second.body as TaskLink;

            const listResponse = await authedRequest()
                .get(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .expect(200);
            const ids = (listResponse.body as TaskLink[]).map((l) => l.id);
            expect(ids).toEqual(
                expect.arrayContaining([firstLink.id, secondLink.id]),
            );
            expect(ids).toHaveLength(2);
        });

        it('POST с невалидным URL отклоняется 4xx (spec: tasks/links#Requirement: Ссылка должна быть валидным адресом)', async () => {
            const res = await authedRequest()
                .post(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .send({ url: 'not-a-valid-url' });
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('DELETE удаляет ссылку, остальные ссылки задачи не затрагиваются (spec: tasks/links#Requirement: Ссылка удаляется из карточки задачи)', async () => {
            const first = await authedRequest()
                .post(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .send({ url: 'https://example.com/a' })
                .expect(201);
            const second = await authedRequest()
                .post(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .send({ url: 'https://example.com/b' })
                .expect(201);
            const firstId = (first.body as TaskLink).id;
            const secondId = (second.body as TaskLink).id;

            await authedRequest()
                .delete(`/v1/tasks/${taskId}/links/${firstId}`)
                .set(...AUTH_HEADER)
                .expect(204);

            const listResponse = await authedRequest()
                .get(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .expect(200);
            const ids = (listResponse.body as TaskLink[]).map((l) => l.id);
            expect(ids).not.toContain(firstId);
            expect(ids).toContain(secondId);
        });

        it('DELETE несуществующей ссылки — 404', async () => {
            await authedRequest()
                .delete(`/v1/tasks/${taskId}/links/missing-link-id`)
                .set(...AUTH_HEADER)
                .expect(404);
        });

        it('DELETE ссылки, принадлежащей другой задаче — 404 (не удаляется через чужую задачу)', async () => {
            const created = await authedRequest()
                .post(`/v1/tasks/${taskId}/links`)
                .set(...AUTH_HEADER)
                .send({ url: 'https://example.com/foreign' })
                .expect(201);
            const linkId = (created.body as TaskLink).id;

            await authedRequest()
                .delete(`/v1/tasks/other-task/links/${linkId}`)
                .set(...AUTH_HEADER)
                .expect(404);
        });
    });
});
