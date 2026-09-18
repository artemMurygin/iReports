import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionService } from '../infrastructure/session.service';
import type { ApiKeyRepository } from '../infrastructure/api-key.repository';
import { ApiKey } from '../domain/value-objects/api-key.value-object';

// spec: session#reject-requests-without-valid-session — fail-closed
// (design.md, Decision 10): и отсутствие session_id, и невалидная сессия, и
// недоступность Redis трактуются одинаково — 401, обработчик роута не
// выполняется. spec: roles#public-routes-no-authentication — @Public()
// освобождает роут от проверки сессии вовсе (design.md, Decision 5).
// spec: auth/api-key — раздел ниже покрывает ветку X-Api-Key (design.md,
// Decision 3), добавленную add-employee-api-key-auth.
describe('SessionAuthGuard', () => {
    const buildContext = (request: any): ExecutionContext =>
        ({
            switchToHttp: () => ({
                getRequest: () => request,
            }),
            getHandler: () => ({}),
            getClass: () => ({}),
        }) as unknown as ExecutionContext;

    const createGuard = (isPublic = false) => {
        const validateSessionAndTouch = jest.fn();
        const sessionService = {
            validateSessionAndTouch,
        } as unknown as SessionService;
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue(isPublic),
        } as unknown as Reflector;
        const findActiveEmployeeByApiKeyHash = jest.fn();
        const apiKeyRepository = {
            findActiveEmployeeByApiKeyHash,
        } as unknown as ApiKeyRepository;
        const resolvePermissions = jest.fn();
        // design.md Decision 3 / WHY в session-auth.guard.ts:
        // PERMISSIONS_RESOLVER_PORT резолвится лениво через
        // ModuleRef.get(..., { strict: false }), а не constructor-DI —
        // мокаем сам ModuleRef.get.
        const moduleRefGet = jest.fn().mockReturnValue({ resolvePermissions });
        const moduleRef = { get: moduleRefGet } as unknown as ModuleRef;
        const guard = new SessionAuthGuard(
            sessionService,
            reflector,
            apiKeyRepository,
            moduleRef,
        );
        return {
            guard,
            validateSessionAndTouch,
            findActiveEmployeeByApiKeyHash,
            resolvePermissions,
            moduleRefGet,
        };
    };

    it('пропускает запрос с валидным session_id из Authorization-заголовка (iframe)', async () => {
        const { guard, validateSessionAndTouch } = createGuard();
        validateSessionAndTouch.mockResolvedValue({
            bitrixEmployeeId: 42,
            permissions: ['reports:view'],
        });
        const request: any = {
            header: (name: string) =>
                name.toLowerCase() === 'authorization'
                    ? 'Bearer session-abc'
                    : undefined,
            cookies: {},
        };

        await expect(guard.canActivate(buildContext(request))).resolves.toBe(
            true,
        );
        expect(validateSessionAndTouch).toHaveBeenCalledWith('session-abc');
        expect(request.user).toEqual({
            employeeId: 42,
            permissions: ['reports:view'],
        });
        // add-employee-api-key-auth, tasks.md 6.3: аутентификация по сессии
        // НЕ выставляет флаг "аутентифицирован по API-ключу" (spec:
        // auth/api-key#Регенерация недоступна без сессии).
        expect(request.authenticatedViaApiKey).toBeUndefined();
    });

    it('пропускает запрос с валидным session_id из cookie (standalone/iOS)', async () => {
        const { guard, validateSessionAndTouch } = createGuard();
        validateSessionAndTouch.mockResolvedValue({
            bitrixEmployeeId: 7,
            permissions: [],
        });
        const request: any = {
            header: () => undefined,
            cookies: { session_id: 'session-xyz' },
        };

        await expect(guard.canActivate(buildContext(request))).resolves.toBe(
            true,
        );
        expect(validateSessionAndTouch).toHaveBeenCalledWith('session-xyz');
    });

    it('отклоняет запрос без session_id вообще (401)', async () => {
        const { guard, validateSessionAndTouch } = createGuard();
        const request: any = { header: () => undefined, cookies: {} };

        await expect(guard.canActivate(buildContext(request))).rejects.toThrow(
            UnauthorizedException,
        );
        expect(validateSessionAndTouch).not.toHaveBeenCalled();
    });

    it('отклоняет запрос с невалидной/истёкшей сессией (401)', async () => {
        const { guard, validateSessionAndTouch } = createGuard();
        validateSessionAndTouch.mockResolvedValue(null);
        const request: any = {
            header: (name: string) =>
                name.toLowerCase() === 'authorization'
                    ? 'Bearer bad-session'
                    : undefined,
            cookies: {},
        };

        await expect(guard.canActivate(buildContext(request))).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('fail-closed: недоступность Redis трактуется как отсутствие валидной сессии (401)', async () => {
        const { guard, validateSessionAndTouch } = createGuard();
        validateSessionAndTouch.mockRejectedValue(
            new Error('ECONNREFUSED redis'),
        );
        const request: any = {
            header: (name: string) =>
                name.toLowerCase() === 'authorization'
                    ? 'Bearer session-abc'
                    : undefined,
            cookies: {},
        };

        await expect(guard.canActivate(buildContext(request))).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('пропускает роут с @Public() без session_id вообще', async () => {
        const { guard, validateSessionAndTouch } = createGuard(true);
        const request: any = { header: () => undefined, cookies: {} };

        await expect(guard.canActivate(buildContext(request))).resolves.toBe(
            true,
        );
        expect(validateSessionAndTouch).not.toHaveBeenCalled();
    });

    // add-employee-api-key-auth, tasks.md 5.1: ветка X-Api-Key проверяется
    // ДО сессионной логики (design.md, Decision 3) — присутствие заголовка
    // само по себе решает исход guard'а, сессия при этом не смотрится.
    describe('аутентификация по X-Api-Key (add-employee-api-key-auth)', () => {
        const apiKeyRequest = (apiKey: string | undefined) => ({
            header: (name: string) =>
                name.toLowerCase() === 'x-api-key' ? apiKey : undefined,
            cookies: {},
        });

        it('валидный ключ аутентифицирует запрос без сессии', async () => {
            const {
                guard,
                validateSessionAndTouch,
                findActiveEmployeeByApiKeyHash,
                resolvePermissions,
            } = createGuard();
            findActiveEmployeeByApiKeyHash.mockResolvedValue({
                employeeId: 99,
            });
            resolvePermissions.mockResolvedValue(['deals:view']);
            const rawKey = 'irk_valid-test-key';
            const request: any = apiKeyRequest(rawKey);

            await expect(
                guard.canActivate(buildContext(request)),
            ).resolves.toBe(true);
            expect(findActiveEmployeeByApiKeyHash).toHaveBeenCalledWith(
                ApiKey.hash(rawKey),
            );
            expect(resolvePermissions).toHaveBeenCalledWith(99);
            expect(request.user).toEqual({
                employeeId: 99,
                permissions: ['deals:view'],
            });
            // add-employee-api-key-auth, tasks.md 6.3: флаг, по которому
            // RegenerateApiKeyHttpController отличает аутентификацию по
            // ключу от аутентификации по сессии (spec: auth/api-key#
            // Регенерация недоступна без сессии).
            expect(request.authenticatedViaApiKey).toBe(true);
            expect(validateSessionAndTouch).not.toHaveBeenCalled();
        });

        it('невалидный/чужой ключ отклоняется (401), в сессионную ветку не идёт', async () => {
            const {
                guard,
                validateSessionAndTouch,
                findActiveEmployeeByApiKeyHash,
            } = createGuard();
            findActiveEmployeeByApiKeyHash.mockResolvedValue(null);
            const request: any = apiKeyRequest('irk_unknown-key');

            await expect(
                guard.canActivate(buildContext(request)),
            ).rejects.toThrow(UnauthorizedException);
            expect(validateSessionAndTouch).not.toHaveBeenCalled();
        });

        // spec: auth/api-key#Ключ уволенного сотрудника перестаёт
        // действовать — репозиторий уже фильтрует isActive: true, поэтому
        // с точки зрения guard'а неактивный сотрудник неотличим от
        // несовпавшего ключа: findActiveEmployeeByApiKeyHash вернёт null
        // в обоих случаях.
        it('ключ уволенного сотрудника отклоняется (401)', async () => {
            const { guard, findActiveEmployeeByApiKeyHash } = createGuard();
            findActiveEmployeeByApiKeyHash.mockResolvedValue(null);
            const request: any = apiKeyRequest('irk_dismissed-employee-key');

            await expect(
                guard.canActivate(buildContext(request)),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('запрос без заголовка X-Api-Key и без сессии по-прежнему отклоняется как раньше (401)', async () => {
            const {
                guard,
                validateSessionAndTouch,
                findActiveEmployeeByApiKeyHash,
            } = createGuard();
            const request: any = apiKeyRequest(undefined);

            await expect(
                guard.canActivate(buildContext(request)),
            ).rejects.toThrow(UnauthorizedException);
            expect(findActiveEmployeeByApiKeyHash).not.toHaveBeenCalled();
            expect(validateSessionAndTouch).not.toHaveBeenCalled();
        });
    });
});
