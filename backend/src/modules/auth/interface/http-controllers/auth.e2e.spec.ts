import type { Server } from 'http';
import { Module, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type {
    AuthMeResponse,
    BitrixEmbeddedLoginResponse,
} from 'ireports-contracts';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { SessionService } from '@/modules/session/infrastructure/session.service';
import {
    SESSION_PORT,
    type SessionPort,
} from '@/modules/session/application/ports/session.port';
import { computeCsrfToken } from '@/modules/session/interface/session-request.util';
import { BitrixEmbeddedLoginHandler } from '../../application/services/bitrix-embedded-login.handler';
import { BitrixOAuthLoginHandler } from '../../application/services/bitrix-oauth-login.handler';
import {
    BITRIX_EMPLOYEE_LOOKUP_PORT,
    type BitrixEmployeeLookupPort,
} from '../../application/ports/bitrix-employee-lookup.port';
import { BitrixEmbeddedLoginHttpController } from './bitrix-embedded-login.http.controller';
import { BitrixOAuthCallbackHttpController } from './bitrix-oauth-callback.http.controller';
import { GetCurrentUserHttpController } from './get-current-user.http.controller';
import { LogoutHttpController } from './logout.http.controller';

// e2e-тесты HTTP-слоя `auth` (раздел 12 tasks.md) — как и roles.e2e.spec.ts
// (см. WHY там), собирают ЛОКАЛЬНЫЙ тестовый модуль вместо реального
// AuthModule: тот тянет BitrixModule/BitrixSyncModule/RolesModule с реальными
// внешними зависимостями (Prisma, Bitrix24 REST, Redis), не нужными для
// проверки именно HTTP-слоя (роутинг, guard'ы, статусы) — бизнес-логика
// хендлеров логина уже исчерпывающе протестирована разделами 5-7
// (bitrix-embedded-login.handler.spec.ts и т.д.).
describe('Auth HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const embeddedExecute = jest.fn();
    const oauthExecute = jest.fn();
    const findById = jest.fn();
    const validateSessionAndTouch = jest.fn();
    const invalidateSession = jest.fn();

    const fakeEmbeddedHandler: Partial<BitrixEmbeddedLoginHandler> = {
        execute: embeddedExecute,
    };
    const fakeOAuthHandler: Partial<BitrixOAuthLoginHandler> = {
        execute: oauthExecute,
    };
    const fakeEmployeeLookup: BitrixEmployeeLookupPort = { findById };
    const fakeSessionService: Partial<SessionService> = {
        validateSessionAndTouch,
    };
    const fakeSessionPort: Partial<SessionPort> = {
        invalidateSession,
    };

    @Module({
        controllers: [
            BitrixEmbeddedLoginHttpController,
            BitrixOAuthCallbackHttpController,
            GetCurrentUserHttpController,
            LogoutHttpController,
        ],
        providers: [
            {
                provide: BitrixEmbeddedLoginHandler,
                useValue: fakeEmbeddedHandler,
            },
            { provide: BitrixOAuthLoginHandler, useValue: fakeOAuthHandler },
            {
                provide: BITRIX_EMPLOYEE_LOOKUP_PORT,
                useValue: fakeEmployeeLookup,
            },
            { provide: SESSION_PORT, useValue: fakeSessionPort },
            { provide: SessionService, useValue: fakeSessionService },
            Reflector,
            SessionAuthGuard,
            CsrfGuard,
        ],
    })
    class AuthTestModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AuthTestModule],
        }).compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        // Нужен для чтения session_id из cookie в CsrfGuard/GetCurrentUser
        // (см. main.ts) — без него req.cookies всегда undefined.
        app.use(cookieParser());
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // spec: auth#embedded-login-success — @Public(), не требует сессии.
    it('POST /v1/auth/embedded-login — 200, возвращает sessionId в теле (доставка через заголовок)', async () => {
        embeddedExecute.mockResolvedValueOnce({
            sessionId: 'session-abc',
            delivery: 'header',
        });

        const response = await request(app.getHttpServer())
            .post('/v1/auth/embedded-login')
            .send({
                authId: 'auth-id-token',
                memberId: 'member-1',
                domain: 'irepair.bitrix24.ru',
            })
            .expect(200);

        expect(embeddedExecute).toHaveBeenCalledWith(
            'auth-id-token',
            'member-1',
            'irepair.bitrix24.ru',
        );
        const body = response.body as BitrixEmbeddedLoginResponse;
        expect(body).toEqual({ sessionId: 'session-abc' });
    });

    // spec: auth#oauth-authorization-code-flow — @Public(); доставка через
    // HttpOnly cookie (spec: session#cookie-delivery-for-standalone-and-ios)
    // — тело ответа НЕ содержит sessionId (spec:
    // auth#client-secret-isolation распространяется на весь ответ).
    it('POST /v1/auth/oauth/callback — 200, устанавливает session_id и csrf_token cookie, тело без sessionId', async () => {
        oauthExecute.mockResolvedValueOnce({
            sessionId: 'session-xyz',
            delivery: 'cookie',
        });

        const response = await request(app.getHttpServer())
            .post('/v1/auth/oauth/callback')
            .send({
                code: 'auth-code',
                state: 'state-value',
                redirectUri: 'https://app.example/auth/callback',
            })
            .expect(200);

        expect(oauthExecute).toHaveBeenCalledWith(
            'auth-code',
            'state-value',
            'https://app.example/auth/callback',
        );
        expect(response.body).toEqual({ success: true });
        expect(JSON.stringify(response.body)).not.toMatch(/session-xyz/);

        const cookies = response.headers['set-cookie'] as unknown as string[];
        const sessionCookie = cookies.find((c) => c.startsWith('session_id='));
        const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
        expect(sessionCookie).toMatch('session_id=session-xyz');
        expect(sessionCookie).toMatch(/HttpOnly/);
        expect(sessionCookie).toMatch(/SameSite=None/);
        expect(csrfCookie).toBeDefined();
        expect(csrfCookie).not.toMatch(/HttpOnly/);
    });

    // spec: roles#session-required-for-protected-routes.
    it('GET /v1/auth/me без сессии — 401', async () => {
        await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
        expect(findById).not.toHaveBeenCalled();
    });

    // spec: roles#get-current-user.
    it('GET /v1/auth/me с валидной сессией — 200, отдаёт employee + permissions', async () => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 42,
            permissions: ['reports:view'],
        });
        findById.mockResolvedValueOnce({
            id: 42,
            firstName: 'Иван',
            lastName: 'Иванов',
            isActive: true,
        });

        const response = await request(app.getHttpServer())
            .get('/v1/auth/me')
            .set('Authorization', 'Bearer session-abc')
            .expect(200);

        const body = response.body as AuthMeResponse;
        expect(body).toEqual({
            employee: { id: 42, firstName: 'Иван', lastName: 'Иванов' },
            permissions: ['reports:view'],
        });
    });

    // spec: session#logout-deletes-session-server-side.
    it('POST /v1/auth/logout без сессии — 401', async () => {
        await request(app.getHttpServer()).post('/v1/auth/logout').expect(401);
        expect(invalidateSession).not.toHaveBeenCalled();
    });

    it('POST /v1/auth/logout с валидной сессией через заголовок — 200, инвалидирует сессию в Redis', async () => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 42,
            permissions: [],
        });

        await request(app.getHttpServer())
            .post('/v1/auth/logout')
            .set('Authorization', 'Bearer session-abc')
            .expect(200);

        expect(invalidateSession).toHaveBeenCalledWith('session-abc');
    });

    // spec: session#csrf-protection-for-cookie-session (раздел 13) — logout
    // мутирует состояние; сессия по cookie без корректного CSRF-токена
    // отклоняется, несмотря на валидность самой сессии.
    it('POST /v1/auth/logout с cookie-сессией, но без CSRF-токена — 403', async () => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 42,
            permissions: [],
        });

        await request(app.getHttpServer())
            .post('/v1/auth/logout')
            .set('Cookie', ['session_id=session-abc'])
            .expect(403);

        expect(invalidateSession).not.toHaveBeenCalled();
    });

    it('POST /v1/auth/logout с cookie-сессией и корректным CSRF-токеном — 200', async () => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 42,
            permissions: [],
        });
        const csrfToken = computeCsrfToken('session-abc');

        await request(app.getHttpServer())
            .post('/v1/auth/logout')
            .set('Cookie', ['session_id=session-abc'])
            .set('x-csrf-token', csrfToken)
            .expect(200);

        expect(invalidateSession).toHaveBeenCalledWith('session-abc');
    });
});
