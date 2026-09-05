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
        const permissionsResolver: jest.Mocked<PermissionsResolverPort> = {
            resolvePermissions: jest.fn(
                async () => options?.permissions ?? [],
            ),
        };

        const sessionPort: jest.Mocked<SessionPort> = {
            createSession: jest.fn(async () => ({ sessionId: 'session-1' })),
            invalidateSession: jest.fn(),
            invalidateAllSessionsForEmployee: jest.fn(),
            refreshPermissionsForEmployee: jest.fn(),
        };

        const bootstrapAdminPort: jest.Mocked<BootstrapAdminPort> = {
            hasAnyRole: jest.fn(async () => options?.hasAnyRole ?? true),
            assignAdministratorRole: jest.fn(),
        };

        const tokenRefreshService = {
            getValidAccessToken: jest.fn(async () => 'valid-access-token'),
        } as unknown as jest.Mocked<BitrixTokenRefreshService>;

        const portalAdminCheckService = {
            isPortalAdmin: jest.fn(async () => options?.isPortalAdmin ?? false),
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
            permissionsResolver,
            sessionPort,
            bootstrapAdminPort,
            tokenRefreshService,
            portalAdminCheckService,
        };
    };

    it('выдаёт сессию с посчитанными permissions (без bootstrap, если у сотрудника уже есть роль)', async () => {
        const { issuer, sessionPort, bootstrapAdminPort, portalAdminCheckService } =
            createIssuer({ hasAnyRole: true, permissions: ['reports:view'] });

        const result = await issuer.issueSession(42, 'header');

        expect(result).toEqual({ sessionId: 'session-1', delivery: 'header' });
        expect(sessionPort.createSession).toHaveBeenCalledWith(
            42,
            ['reports:view'],
            'header',
        );
        // У сотрудника уже есть роль — REST-вызов user.admin избыточен и не
        // выполняется вовсе.
        expect(portalAdminCheckService.isPortalAdmin).not.toHaveBeenCalled();
        expect(bootstrapAdminPort.assignAdministratorRole).not.toHaveBeenCalled();
    });

    it('назначает роль Administrator сотруднику без единой роли, если он админ портала Bitrix24', async () => {
        const {
            issuer,
            bootstrapAdminPort,
            tokenRefreshService,
            portalAdminCheckService,
        } = createIssuer({ hasAnyRole: false, isPortalAdmin: true });

        await issuer.issueSession(42, 'cookie');

        expect(tokenRefreshService.getValidAccessToken).toHaveBeenCalledWith(42);
        expect(portalAdminCheckService.isPortalAdmin).toHaveBeenCalledWith(
            'valid-access-token',
        );
        expect(bootstrapAdminPort.assignAdministratorRole).toHaveBeenCalledWith(
            42,
        );
    });

    it('не назначает роль Administrator сотруднику без единой роли, если он не админ портала', async () => {
        const { issuer, bootstrapAdminPort } = createIssuer({
            hasAnyRole: false,
            isPortalAdmin: false,
        });

        await issuer.issueSession(42, 'cookie');

        expect(bootstrapAdminPort.assignAdministratorRole).not.toHaveBeenCalled();
    });

    it('пересчитывает permissions ПОСЛЕ bootstrap — назначенная роль отражается в той же сессии без релогина', async () => {
        const { permissionsResolver, sessionPort, bootstrapAdminPort, issuer } =
            createIssuer({ hasAnyRole: false, isPortalAdmin: true });

        await issuer.issueSession(42, 'cookie');

        const bootstrapCallOrder =
            bootstrapAdminPort.assignAdministratorRole.mock.invocationCallOrder[0];
        const resolveCallOrder =
            permissionsResolver.resolvePermissions.mock.invocationCallOrder[0];
        const createSessionCallOrder =
            sessionPort.createSession.mock.invocationCallOrder[0];

        expect(bootstrapCallOrder).toBeLessThan(resolveCallOrder);
        expect(resolveCallOrder).toBeLessThan(createSessionCallOrder);
    });
});
