import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionService } from '../infrastructure/session.service';

// spec: session#reject-requests-without-valid-session — fail-closed
// (design.md, Decision 10): и отсутствие session_id, и невалидная сессия, и
// недоступность Redis трактуются одинаково — 401, обработчик роута не
// выполняется. spec: roles#public-routes-no-authentication — @Public()
// освобождает роут от проверки сессии вовсе (design.md, Decision 5).
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
        const guard = new SessionAuthGuard(sessionService, reflector);
        return { guard, validateSessionAndTouch };
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
});
