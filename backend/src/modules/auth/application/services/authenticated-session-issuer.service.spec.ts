import { AuthenticatedSessionIssuer } from './authenticated-session-issuer.service';
import type { PermissionsResolverPort } from '../../../roles/application/ports/permissions-resolver.port';
import type { SessionPort } from '../../../session/application/ports/session.port';
import type { BootstrapAdminPort } from '../../../roles/application/ports/bootstrap-admin.port';
import type { BitrixTokenRefreshService } from './bitrix-token-refresh.service';
import type { BitrixPortalAdminCheckService } from '@/integrations/bitrix/auth/portal-admin-check.service';

// spec: roles (design.md, Decision 9 — bootstrap первого администратора,
// раздел 11 tasks.md) — при логине сотрудника без единой роли backend
// вызывает Bitrix24 REST user.admin с его токеном (тот же приём, что
// BitrixPortalAdminCheckService); если сотрудник — админ портала, ему
// назначается системная роль Administrator ДО выдачи сессии (чтобы
// permissions отразили это без релогина); если не админ — роль не
// назначается. Сотрудникам, у которых уже есть хотя бы одна роль,
// REST-вызов user.admin не выполняется вовсе.
describe('AuthenticatedSessionIssuer', () => {
    const createIssuer = (options?: {
        hasAnyRole?: boolean;
        isPortalAdmin?: boolean;
        permissions?: string[];
    }) => {
        const resolvePermissions = jest.fn(() =>
            Promise.resolve(options?.permissions ?? []),
        );
        const permissionsResolver: jest.Mocked<PermissionsResolverPort> = {
            resolvePermissions,
        };

        const createSession = jest.fn(() =>
            Promise.resolve({ sessionId: 'session-1' }),
        );
        const sessionPort: jest.Mocked<SessionPort> = {
            createSession,
            invalidateSession: jest.fn(),
            invalidateAllSessionsForEmployee: jest.fn(),
            refreshPermissionsForEmployee: jest.fn(),
        };

        const hasAnyRole = jest.fn(() =>
            Promise.resolve(options?.hasAnyRole ?? true),
        );
        const assignAdministratorRole = jest.fn(() => Promise.resolve());
        const bootstrapAdminPort: jest.Mocked<BootstrapAdminPort> = {
            hasAnyRole,
            assignAdministratorRole,
        };

        const getValidAccessToken = jest.fn(() =>
            Promise.resolve('valid-access-token'),
        );
        const tokenRefreshService = {
            getValidAccessToken,
        } as unknown as jest.Mocked<BitrixTokenRefreshService>;

        const isPortalAdmin = jest.fn(() =>
            Promise.resolve(options?.isPortalAdmin ?? false),
        );
        const portalAdminCheckService = {
            isPortalAdmin,
        } as unknown as jest.Mocked<BitrixPortalAdminCheckService>;

        const issuer = new AuthenticatedSessionIssuer(
            permissionsResolver,
            sessionPort,
            bootstrapAdminPort,
            tokenRefreshService,
            portalAdminCheckService,
        );

        return {
            issuer,
            resolvePermissions,
            createSession,
            hasAnyRole,
            assignAdministratorRole,
            getValidAccessToken,
            isPortalAdmin,
        };
    };

    it('выдаёт сессию с посчитанными permissions (без bootstrap, если у сотрудника уже есть роль)', async () => {
        const {
            issuer,
            createSession,
            isPortalAdmin,
            assignAdministratorRole,
        } = createIssuer({ hasAnyRole: true, permissions: ['reports:view'] });

        const result = await issuer.issueSession(42, 'header');

        expect(result).toEqual({ sessionId: 'session-1', delivery: 'header' });
        expect(createSession).toHaveBeenCalledWith(
            42,
            ['reports:view'],
            'header',
        );
        // У сотрудника уже есть роль — REST-вызов user.admin избыточен и не
        // выполняется вовсе.
        expect(isPortalAdmin).not.toHaveBeenCalled();
        expect(assignAdministratorRole).not.toHaveBeenCalled();
    });

    it('назначает роль Administrator сотруднику без единой роли, если он админ портала Bitrix24', async () => {
        const {
            issuer,
            getValidAccessToken,
            isPortalAdmin,
            assignAdministratorRole,
        } = createIssuer({ hasAnyRole: false, isPortalAdmin: true });

        await issuer.issueSession(42, 'cookie');

        expect(getValidAccessToken).toHaveBeenCalledWith(42);
        expect(isPortalAdmin).toHaveBeenCalledWith(
            'valid-access-token',
            undefined,
        );
        expect(assignAdministratorRole).toHaveBeenCalledWith(42);
    });

    it('прокидывает clientEndpoint от login-хендлера в isPortalAdmin, минуя БД-lookup BitrixInstallation', async () => {
        const { issuer, isPortalAdmin } = createIssuer({
            hasAnyRole: false,
            isPortalAdmin: true,
        });

        await issuer.issueSession(
            42,
            'cookie',
            'https://irepair.bitrix24.ru/rest/',
        );

        expect(isPortalAdmin).toHaveBeenCalledWith(
            'valid-access-token',
            'https://irepair.bitrix24.ru/rest/',
        );
    });

    it('не назначает роль Administrator сотруднику без единой роли, если он не админ портала', async () => {
        const { issuer, assignAdministratorRole } = createIssuer({
            hasAnyRole: false,
            isPortalAdmin: false,
        });

        await issuer.issueSession(42, 'cookie');

        expect(assignAdministratorRole).not.toHaveBeenCalled();
    });

    it('пересчитывает permissions ПОСЛЕ bootstrap — назначенная роль отражается в той же сессии без релогина', async () => {
        const {
            issuer,
            resolvePermissions,
            createSession,
            assignAdministratorRole,
        } = createIssuer({ hasAnyRole: false, isPortalAdmin: true });

        await issuer.issueSession(42, 'cookie');

        const bootstrapCallOrder =
            assignAdministratorRole.mock.invocationCallOrder[0];
        const resolveCallOrder = resolvePermissions.mock.invocationCallOrder[0];
        const createSessionCallOrder =
            createSession.mock.invocationCallOrder[0];

        expect(bootstrapCallOrder).toBeLessThan(resolveCallOrder);
        expect(resolveCallOrder).toBeLessThan(createSessionCallOrder);
    });
});
