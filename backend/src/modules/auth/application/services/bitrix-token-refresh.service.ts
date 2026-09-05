import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import {
    BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY,
    type BitrixEmployeeCredentialsRepositoryPort,
} from '../ports/bitrix-employee-credentials.port';
import { BitrixCredentials } from '../../domain/value-objects/bitrix-credentials.value-object';

// oauth.bitrix24.tech — актуальный OAuth-эндпоинт Bitrix24 для токенов
// СОТРУДНИКА (design.md, Decision 3), сознательно отдельный от legacy
// oauth.bitrix.info, используемого install-flow'ом приложения
// (BitrixAuthService.refreshTokens) — два независимых клиента к двум
// разным аудиториям токенов.
const BITRIX_OAUTH_TOKEN_URL = 'https://oauth.bitrix24.tech/oauth/token/';

interface BitrixOAuthTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

// spec: auth#automatic-token-refresh — проверяет expiresAt и обновляет
// access_token через refresh_token ДО того, как backend выполнит запрос к
// Bitrix24 REST от имени сотрудника.
@Injectable()
export class BitrixTokenRefreshService {
    constructor(
        @Inject(BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY)
        private readonly repository: BitrixEmployeeCredentialsRepositoryPort,
    ) {}

    async getValidAccessToken(bitrixEmployeeId: number): Promise<string> {
        const entity = await this.repository.findByEmployeeId(
            bitrixEmployeeId,
        );
        if (!entity) {
            throw new UnauthorizedException(
                `Для сотрудника ${bitrixEmployeeId} нет сохранённых токенов Bitrix24 — требуется повторный вход`,
            );
        }

        if (!entity.credentials.isExpired()) {
            return entity.credentials.accessToken;
        }

        const refreshed = await this.refreshViaBitrixOAuth(
            entity.credentials.refreshToken,
        );
        const updatedCredentials = BitrixCredentials.create({
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        });
        entity.updateCredentials(updatedCredentials);
        await this.repository.upsert(entity);

        return updatedCredentials.accessToken;
    }

    private async refreshViaBitrixOAuth(
        refreshToken: string,
    ): Promise<BitrixOAuthTokenResponse> {
        try {
            const { data } = await axios.get<BitrixOAuthTokenResponse>(
                BITRIX_OAUTH_TOKEN_URL,
                {
                    params: {
                        grant_type: 'refresh_token',
                        client_id: process.env.BITRIX24_CLIENT_ID,
                        client_secret: process.env.BITRIX24_CLIENT_SECRET,
                        refresh_token: refreshToken,
                    },
                    timeout: 5_000,
                },
            );
            return data;
        } catch {
            throw new UnauthorizedException(
                'Не удалось обновить access_token Bitrix24 через refresh_token',
            );
        }
    }
}
