import { BitrixEmbeddedLoginHandler } from './bitrix-embedded-login.handler';
import type { BitrixIdentityResolver } from './bitrix-identity-resolver.service';
import type { AuthenticatedSessionIssuer } from './authenticated-session-issuer.service';

// spec: auth#embedded-login-success — успешный вход из iframe портала
// Bitrix24 создаёт сессию ТОЛЬКО после подтверждения AUTH_ID реальным
// REST-запросом (делегируется BitrixIdentityResolver); доставка session_id
// для embedded-контекста — заголовок Authorization (spec:
// session#header-delivery-for-iframe). `clientEndpoint` строится напрямую
// из `domain`, переданного фронтендом (contracts/commands/auth.ts), — без
// похода в БД за `BitrixInstallation` (`BitrixAuthService.getInstallation`
// требовал бы install-вебхука, который может не вызываться для упрощённо
// зарегистрированного тестового приложения Bitrix24).
describe('BitrixEmbeddedLoginHandler', () => {
    const createHandler = () => {
        const resolveBitrixEmployeeId = jest.fn().mockResolvedValue({
            bitrixEmployeeId: 42,
            profile: { ID: '42', NAME: 'Иван', LAST_NAME: 'Иванов' },
        });
        const identityResolver = {
            resolveBitrixEmployeeId,
        } as unknown as BitrixIdentityResolver;

        const issueSession = jest.fn().mockResolvedValue({
            sessionId: 'session-abc',
            delivery: 'header',
        });
        const sessionIssuer = {
            issueSession,
        } as unknown as AuthenticatedSessionIssuer;

        const handler = new BitrixEmbeddedLoginHandler(
            identityResolver,
            sessionIssuer,
        );

        return { handler, resolveBitrixEmployeeId, issueSession };
    };

    it('строит clientEndpoint из domain и создаёт сессию с доставкой через заголовок', async () => {
        const { handler, resolveBitrixEmployeeId, issueSession } =
            createHandler();

        const result = await handler.execute(
            'auth-id-token',
            'member-1',
            'irepair.bitrix24.ru',
        );

        expect(resolveBitrixEmployeeId).toHaveBeenCalledWith(
            'auth-id-token',
            'https://irepair.bitrix24.ru/rest/',
        );
        expect(issueSession).toHaveBeenCalledWith(42, 'header');
        expect(result).toEqual({
            sessionId: 'session-abc',
            delivery: 'header',
        });
    });
});
