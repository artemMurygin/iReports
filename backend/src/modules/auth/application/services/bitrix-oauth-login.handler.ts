import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { BitrixIdentityResolver } from './bitrix-identity-resolver.service';
import {
    AuthenticatedSessionIssuer,
    type IssuedSession,
} from './authenticated-session-issuer.service';
import {
    BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY,
    type BitrixEmployeeCredentialsRepositoryPort,
} from '../ports/bitrix-employee-credentials.port';
import { BitrixEmployeeCredentials } from '../../domain/entities/bitrix-employee-credentials.entity';
import { BitrixCredentials } from '../../domain/value-objects/bitrix-credentials.value-object';

// Тот же актуальный OAuth-эндпоинт Bitrix24, что и BitrixTokenRefreshService
// (design.md, Decision 3) — не legacy oauth.bitrix.info install-flow'а.
const BITRIX_OAUTH_TOKEN_URL = 'https://oauth.bitrix24.tech/oauth/token/';

interface BitrixOAuthTokenExchangeResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    domain: string;
    member_id: string;
}

// spec: auth#oauth-authorization-code-flow — обмен `code` на токены строго
// серверным запросом (client_secret никогда не покидает backend — spec:
// auth#client-secret-isolation), затем тот же общий шаг резолва identity
// (BitrixIdentityResolver), что и у embedded-сценария (design.md, Decision
// 2 — "единая точка сборки"). Один и тот же обработчик используется для
// standalone-сайта и iOS (redirect_uri в виде universal link/кастомной URL-
// схемы обрабатывается тем же эндпоинтом обмена кода — spec:
// auth#ios-oauth).
@Injectable()
export class BitrixOAuthLoginHandler {
    constructor(
        private readonly identityResolver: BitrixIdentityResolver,
        private readonly sessionIssuer: AuthenticatedSessionIssuer,
        @Inject(BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY)
        private readonly credentialsRepository: BitrixEmployeeCredentialsRepositoryPort,
    ) {}

    // `state` — параметр OAuth-редиректа (принимается по сигнатуре
    // architecture.md); проверка его соответствия значению, выданному перед
    // редиректом, не описана ни в proposal.md, ни в specs/auth — оставлена
    // как открытый вопрос для отдельного уточнения (см. финальный отчёт).
    async execute(code: string, state?: string): Promise<IssuedSession> {
        void state;
        const tokenResponse = await this.exchangeCodeForTokens(code);
        const clientEndpoint = `https://${tokenResponse.domain}/rest/`;

        const { bitrixEmployeeId } =
            await this.identityResolver.resolveBitrixEmployeeId(
                tokenResponse.access_token,
                clientEndpoint,
            );

        const credentials = BitrixCredentials.create({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        });
        const entity = BitrixEmployeeCredentials.create({
            bitrixEmployeeId,
            memberId: tokenResponse.member_id,
            credentials,
        });
        await this.credentialsRepository.upsert(entity);

        // Доставка session_id для standalone-сайта/iOS — HttpOnly/Secure/
        // SameSite=None cookie (spec: session#cookie-delivery-for-standalone-and-ios).
        return this.sessionIssuer.issueSession(bitrixEmployeeId, 'cookie');
    }

    private async exchangeCodeForTokens(
        code: string,
    ): Promise<BitrixOAuthTokenExchangeResponse> {
        try {
            const { data } = await axios.get<BitrixOAuthTokenExchangeResponse>(
                BITRIX_OAUTH_TOKEN_URL,
                {
                    params: {
                        grant_type: 'authorization_code',
                        client_id: process.env.BITRIX24_CLIENT_ID,
                        client_secret: process.env.BITRIX24_CLIENT_SECRET,
                        code,
                    },
                    timeout: 5_000,
                },
            );
            return data;
        } catch {
            throw new UnauthorizedException(
                'Не удалось обменять code на токены Bitrix24',
            );
        }
    }
}
