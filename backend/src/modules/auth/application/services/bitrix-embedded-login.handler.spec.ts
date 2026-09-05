import { BitrixEmbeddedLoginHandler } from './bitrix-embedded-login.handler';
import type { BitrixIdentityResolver } from './bitrix-identity-resolver.service';
import type { AuthenticatedSessionIssuer } from './authenticated-session-issuer.service';
import type { BitrixAuthService } from '@/integrations/bitrix/bitrix-auth.service';

// spec: auth#embedded-login-success — успешный вход из iframe портала
// Bitrix24 создаёт сессию ТОЛЬКО после подтверждения AUTH_ID реальным
// REST-запросом (делегируется BitrixIdentityResolver); доставка session_id
// для embedded-контекста — заголовок Authorization (spec:
// session#header-delivery-for-iframe).
describe('BitrixEmbeddedLoginHandler', () => {
    const createHandler = () => {
        const getInstallation = jest.fn().mockResolvedValue({
            clientEndpoint: 'https://irepair.bitrix24.ru/rest/',
        });
        const bitrixAuthService = {
            getInstallation,
        } as unknown as BitrixAuthService;

        const resolveBitrixEmployeeId = jest.fn().mockResolvedValue({
            bitrixEmployeeId: 42,
            profile: { ID: '42', NAME: 'Иван', LAST_NAME: 'Иванов' },
        });
        const identityResolver = {
            resolveBitrixEmployeeId,
        } as unknown as BitrixIdentityResolver;

        const issueSession = jest
            .fn()
            .mockResolvedValue({ sessionId: 'session-abc', delivery: 'header' });
        const sessionIssuer = { issueSession } as unknown as AuthenticatedSessionIssuer;

        const handler = new BitrixEmbeddedLoginHandler(
            bitrixAuthService,
            identityResolver,
            sessionIssuer,
        );

        return { handler, getInstallation, resolveBitrixEmployeeId, issueSession };
    };

    it('валидирует AUTH_ID через Bitrix REST и создаёт сессию с доставкой через заголовок', async () => {
        const { handler, getInstallation, resolveBitrixEmployeeId, issueSession } =
            createHandler();

        const result = await handler.execute('auth-id-token', 'member-1');

        expect(getInstallation).toHaveBeenCalledWith('member-1');
        expect(resolveBitrixEmployeeId).toHaveBeenCalledWith(
            'auth-id-token',
            'https://irepair.bitrix24.ru/rest/',
        );
        expect(issueSession).toHaveBeenCalledWith(42, 'header');
        expect(result).toEqual({ sessionId: 'session-abc', delivery: 'header' });
    });
});
