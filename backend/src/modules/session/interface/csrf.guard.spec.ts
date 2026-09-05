import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { computeCsrfToken } from './session-request.util';

// spec: session#csrf-protection-for-cookie-session — double-submit cookie
// (design.md, Decision 7): изменяющий состояние запрос, аутентифицированный
// cookie-сессией, без корректного CSRF-токена отклоняется, несмотря на
// валидность самой сессии; запрос с корректным токеном проходит. Применяется
// только к cookie-варианту доставки (SameSite=None допускает cross-site
// отправку cookie) — Authorization: Bearer (iframe) не подвержен CSRF таким
// образом и не требует проверки (design.md, Decision 1/раздел 13 tasks.md).
describe('CsrfGuard', () => {
    const buildContext = (request: Record<string, unknown>): ExecutionContext =>
        ({
            switchToHttp: () => ({ getRequest: () => request }),
            getHandler: () => ({}),
            getClass: () => ({}),
        }) as unknown as ExecutionContext;

    const createGuard = (isPublic = false) => {
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue(isPublic),
        } as unknown as Reflector;
        return new CsrfGuard(reflector);
    };

    const cookieRequest = (
        method: string,
        sessionId: string | undefined,
        csrfHeader: string | undefined,
    ) => ({
        method,
        header: (name: string) =>
            name.toLowerCase() === 'x-csrf-token' ? csrfHeader : undefined,
        cookies: sessionId ? { session_id: sessionId } : {},
    });

    it('отклоняет POST с валидной cookie-сессией, но без CSRF-токена (403)', () => {
        const guard = createGuard();
        const request = cookieRequest('POST', 'session-abc', undefined);

        expect(() => guard.canActivate(buildContext(request))).toThrow(
            ForbiddenException,
        );
    });

    it('отклоняет POST с неверным CSRF-токеном (403)', () => {
        const guard = createGuard();
        const request = cookieRequest('POST', 'session-abc', 'wrong-token');

        expect(() => guard.canActivate(buildContext(request))).toThrow(
            ForbiddenException,
        );
    });

    it('пропускает POST с корректным double-submit CSRF-токеном', () => {
        const guard = createGuard();
        const token = computeCsrfToken('session-abc');
        const request = cookieRequest('POST', 'session-abc', token);

        expect(guard.canActivate(buildContext(request))).toBe(true);
    });

    it('пропускает безопасные методы (GET) без проверки CSRF', () => {
        const guard = createGuard();
        const request = cookieRequest('GET', 'session-abc', undefined);

        expect(guard.canActivate(buildContext(request))).toBe(true);
    });

    it('пропускает запросы, аутентифицированные через Authorization-заголовок (iframe), без проверки CSRF', () => {
        const guard = createGuard();
        const request = {
            method: 'POST',
            header: (name: string) =>
                name.toLowerCase() === 'authorization'
                    ? 'Bearer session-abc'
                    : undefined,
            cookies: {},
        };

        expect(guard.canActivate(buildContext(request))).toBe(true);
    });

    it('пропускает публичный роут без проверки CSRF', () => {
        const guard = createGuard(true);
        const request = cookieRequest('POST', 'session-abc', undefined);

        expect(guard.canActivate(buildContext(request))).toBe(true);
    });

    it('пропускает запрос без cookie-сессии вовсе (обработка отсутствия сессии — забота SessionAuthGuard)', () => {
        const guard = createGuard();
        const request = cookieRequest('POST', undefined, undefined);

        expect(guard.canActivate(buildContext(request))).toBe(true);
    });
});
