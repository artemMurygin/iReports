import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

// spec: roles#permission-check-on-route /
// roles#route-without-permissions-open-to-any-authenticated /
// roles#public-routes-no-authentication.
describe('PermissionsGuard', () => {
    const buildContext = (
        user: { permissions: string[] } | undefined,
    ): ExecutionContext =>
        ({
            switchToHttp: () => ({ getRequest: () => ({ user }) }),
            getHandler: () => ({}),
            getClass: () => ({}),
        }) as unknown as ExecutionContext;

    const createGuard = (metadata: {
        isPublic?: boolean;
        permissions?: string[];
    }) => {
        const getAllAndOverride = jest.fn((key: string) => {
            if (key === 'isPublic') return metadata.isPublic;
            if (key === 'requiredPermissions') return metadata.permissions;
            return undefined;
        });
        const reflector = { getAllAndOverride } as unknown as Reflector;
        return new PermissionsGuard(reflector);
    };

    it('пропускает публичный роут без проверки permissions', () => {
        const guard = createGuard({ isPublic: true });

        expect(guard.canActivate(buildContext(undefined))).toBe(true);
    });

    it('пропускает роут без @RequirePermissions любому аутентифицированному пользователю', () => {
        const guard = createGuard({ permissions: undefined });

        expect(
            guard.canActivate(buildContext({ permissions: ['anything'] })),
        ).toBe(true);
    });

    it('пропускает пользователя, у которого есть все требуемые permissions', () => {
        const guard = createGuard({ permissions: ['reports:edit'] });

        expect(
            guard.canActivate(
                buildContext({ permissions: ['reports:view', 'reports:edit'] }),
            ),
        ).toBe(true);
    });

    it('отклоняет пользователя без хотя бы одного требуемого permission (403)', () => {
        const guard = createGuard({ permissions: ['reports:edit'] });

        expect(() =>
            guard.canActivate(buildContext({ permissions: ['reports:view'] })),
        ).toThrow(ForbiddenException);
    });

    it('отклоняет пользователя вовсе без permissions в сессии (403)', () => {
        const guard = createGuard({ permissions: ['roles:manage'] });

        expect(() =>
            guard.canActivate(buildContext({ permissions: [] })),
        ).toThrow(ForbiddenException);
    });
});
