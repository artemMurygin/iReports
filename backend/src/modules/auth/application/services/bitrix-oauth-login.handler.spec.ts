import axios from 'axios';
import { UnauthorizedException } from '@nestjs/common';
import { BitrixOAuthLoginHandler } from './bitrix-oauth-login.handler';
import type { BitrixIdentityResolver } from './bitrix-identity-resolver.service';
import type { AuthenticatedSessionIssuer } from './authenticated-session-issuer.service';
import type { BitrixEmployeeCredentialsRepositoryPort } from '../ports/bitrix-employee-credentials.port';

jest.mock('axios');
const axiosGet = jest.spyOn(axios, 'get');

// spec: auth#oauth-authorization-code-flow / auth#oauth-code-exchange-without-delay
// / auth#client-secret-isolation — обмен code на токены строго server-to-server
// через oauth.bitrix24.tech/oauth/token/ (design.md, Decision 3 — не legacy
// oauth.bitrix.info из install-flow); доставка session_id для standalone/iOS —
// cookie (spec: session#cookie-delivery-for-standalone-and-ios).
describe('BitrixOAuthLoginHandler', () => {
    const createHandler = () => {
        const resolveBitrixEmployeeId = jest.fn().mockResolvedValue({
            bitrixEmployeeId: 42,
            profile: { ID: '42', NAME: 'Иван', LAST_NAME: 'Иванов' },
        });
        const identityResolver = {
            resolveBitrixEmployeeId,
        } as unknown as BitrixIdentityResolver;

        const issueSession = jest.fn().mockResolvedValue({
            sessionId: 'session-xyz',
            delivery: 'cookie',
        });
        const sessionIssuer = {
            issueSession,
        } as unknown as AuthenticatedSessionIssuer;

        const upsert = jest.fn().mockResolvedValue(undefined);
        const credentialsRepository: BitrixEmployeeCredentialsRepositoryPort = {
            findByEmployeeId: jest.fn(),
            upsert,
        };

        const handler = new BitrixOAuthLoginHandler(
            identityResolver,
            sessionIssuer,
            credentialsRepository,
        );

        return {
            handler,
            resolveBitrixEmployeeId,
            issueSession,
            upsert,
        };
    };

    beforeEach(() => jest.clearAllMocks());

    it('обменивает code на токены через oauth.bitrix24.tech и создаёт сессию с доставкой cookie', async () => {
        const { handler, resolveBitrixEmployeeId, issueSession, upsert } =
            createHandler();
        axiosGet.mockResolvedValueOnce({
            data: {
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                expires_in: 3600,
                // `domain` в ответе oauth.bitrix24.tech — домен сервера
                // авторизации, НЕ портала (apidocs.bitrix24.ru/api-reference/oauth) —
                // адрес REST API портала берётся из `client_endpoint`.
                domain: 'oauth.bitrix24.tech',
                client_endpoint: 'https://irepair.bitrix24.ru/rest/',
                member_id: 'member-1',
            },
        });

        const result = await handler.execute(
            'auth-code',
            'state-value',
            'https://app.example/auth/callback',
        );

        expect(axiosGet).toHaveBeenCalledWith(
            'https://oauth.bitrix24.tech/oauth/token/',
            {
                params: expect.objectContaining({
                    grant_type: 'authorization_code',
                    code: 'auth-code',
                    redirect_uri: 'https://app.example/auth/callback',
                }),
                timeout: 5_000,
            },
        );
        expect(resolveBitrixEmployeeId).toHaveBeenCalledWith(
            'new-access',
            'https://irepair.bitrix24.ru/rest/',
        );
        expect(upsert).toHaveBeenCalledTimes(1);
        expect(issueSession).toHaveBeenCalledWith(
            42,
            'cookie',
            'https://irepair.bitrix24.ru/rest/',
        );
        expect(result).toEqual({
            sessionId: 'session-xyz',
            delivery: 'cookie',
        });
    });

    it('не содержит client_secret нигде в возвращаемом результате', async () => {
        const { handler } = createHandler();
        axiosGet.mockResolvedValueOnce({
            data: {
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                expires_in: 3600,
                domain: 'oauth.bitrix24.tech',
                client_endpoint: 'https://irepair.bitrix24.ru/rest/',
                member_id: 'member-1',
            },
        });

        const result = await handler.execute('auth-code');

        expect(JSON.stringify(result)).not.toMatch(/secret/i);
    });

    it('бросает UnauthorizedException, если Bitrix24 отклонил обмен code на токены', async () => {
        const { handler } = createHandler();
        axiosGet.mockRejectedValueOnce(new Error('invalid_grant'));

        await expect(handler.execute('bad-code')).rejects.toThrow(
            UnauthorizedException,
        );
    });
});
