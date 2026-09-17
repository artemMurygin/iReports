import type { Server } from 'http';
import { INestApplication, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import { RegenerateApiKeyHttpController } from './regenerate-api-key.http-controller';
import { SessionAuthGuard } from '../session-auth.guard';
import { CsrfGuard } from '../csrf.guard';
import { SessionService } from '../../infrastructure/session.service';
import { ApiKeyRepository } from '../../infrastructure/api-key.repository';
import { PERMISSIONS_RESOLVER_PORT } from '@/modules/roles/application/ports/permissions-resolver.port';

// add-employee-api-key-auth, раздел 6 tasks.md (6.3), spec: auth/api-key#
// Регенерация недоступна без сессии. Собирает минимальный тестовый модуль
// только с этим контроллером и реальными SessionAuthGuard/CsrfGuard,
// применёнными через `@UseGuards` (тем же приёмом, что
// app.module.guards.e2e.spec.ts, но точечно на контроллере, а не как
// APP_GUARD) — зависимости (SessionService/ApiKeyRepository/
// PermissionsResolverPort) подменены фейками, доказывающими наблюдаемое
// поведение HTTP-слоя end-to-end (guard -> controller), а не саму бизнес-
// логику ApiKeyRepository (уже покрыта api-key.repository.spec.ts).
describe('RegenerateApiKeyHttpController (e2e)', () => {
    let app: INestApplication<Server>;

    const validateSessionAndTouch = jest.fn();
    const fakeSessionService: Partial<SessionService> = {
        validateSessionAndTouch,
    };

    const findActiveEmployeeByApiKeyHash = jest.fn();
    const regenerateApiKey = jest.fn();
    const fakeApiKeyRepository: Partial<ApiKeyRepository> = {
        findActiveEmployeeByApiKeyHash,
        regenerateApiKey,
    };

    const fakePermissionsResolver = { resolvePermissions: jest.fn() };

    @Module({
        controllers: [RegenerateApiKeyHttpController],
        providers: [
            { provide: SessionService, useValue: fakeSessionService },
            { provide: ApiKeyRepository, useValue: fakeApiKeyRepository },
            {
                provide: PERMISSIONS_RESOLVER_PORT,
                useValue: fakePermissionsResolver,
            },
            Reflector,
            SessionAuthGuard,
            CsrfGuard,
        ],
    })
    class RegenerateApiKeyTestModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [RegenerateApiKeyTestModule],
        }).compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // spec: auth/api-key#Регенерация недоступна без сессии
    it('запрос без сессии получает 401 и не регенерирует ключ', async () => {
        await request(app.getHttpServer())
            .post('/v1/auth/api-key/regenerate')
            .expect(401);

        expect(regenerateApiKey).not.toHaveBeenCalled();
    });

    // add-employee-api-key-auth, tasks.md 6.3, spec: auth/api-key#
    // Регенерация недоступна без сессии. SessionAuthGuard заполняет
    // request.user ОДИНАКОВО для сессии и для X-Api-Key — без отдельной
    // проверки в контроллере валидный (но чужой канал) API-ключ мог бы
    // сам себя перевыпускать через этот эндпоинт.
    it('запрос с валидным X-Api-Key, но без сессии, получает 401 и не регенерирует ключ', async () => {
        findActiveEmployeeByApiKeyHash.mockResolvedValueOnce({
            employeeId: 42,
        });
        fakePermissionsResolver.resolvePermissions.mockResolvedValueOnce([]);

        await request(app.getHttpServer())
            .post('/v1/auth/api-key/regenerate')
            .set('X-Api-Key', 'irk_valid-but-wrong-channel')
            .expect(401);

        expect(regenerateApiKey).not.toHaveBeenCalled();
    });

    // spec: auth/api-key#Регенерация выдаёт новый ключ и деактивирует старый
    it('запрос с валидной сессией регенерирует ключ и возвращает новое значение', async () => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 42,
            permissions: [],
        });
        regenerateApiKey.mockResolvedValueOnce('irk_new-value');

        const response = await request(app.getHttpServer())
            .post('/v1/auth/api-key/regenerate')
            .set('Authorization', 'Bearer session-abc')
            .expect(200);

        expect(response.body).toEqual({ apiKey: 'irk_new-value' });
        expect(regenerateApiKey).toHaveBeenCalledWith(42);
    });

    // tasks.md 6.2, проверка: "эндпоинт виден в Swagger/OpenAPI-описании
    // (nest build проходит, роут зарегистрирован)" — тот же приём, что
    // swagger.config.e2e.spec.ts (SwaggerModule.createDocument никогда не
    // выполняет запросов, ей достаточно того, что граф DI уже собран).
    it('эндпоинт присутствует в сгенерированном OpenAPI-документе', () => {
        const config = new DocumentBuilder()
            .setTitle('iReports API — Common (test)')
            .setVersion('1.0')
            .build();

        let document: ReturnType<typeof SwaggerModule.createDocument>;
        expect(() => {
            document = SwaggerModule.createDocument(app, config, {
                include: [RegenerateApiKeyTestModule],
            });
        }).not.toThrow();
        expect(() => cleanupOpenApiDoc(document!)).not.toThrow();

        expect(Object.keys(document!.paths)).toContain(
            '/v1/auth/api-key/regenerate',
        );
    });
});
