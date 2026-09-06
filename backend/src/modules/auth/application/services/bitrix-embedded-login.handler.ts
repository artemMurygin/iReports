import { Injectable } from '@nestjs/common';
import { BitrixIdentityResolver } from './bitrix-identity-resolver.service';
import {
    AuthenticatedSessionIssuer,
    type IssuedSession,
} from './authenticated-session-issuer.service';

// spec: auth#embedded-login-success / auth#embedded-token-must-be-verified-via-rest.
// Оркестрирует embedded/iframe-сценарий входа: AUTH_ID/member_id из
// BX24.init() не доверяются напрямую (Requirement "Обязательная валидация
// embedded-токена запросом к Bitrix24 REST") — валидация делегируется
// BitrixIdentityResolver.
@Injectable()
export class BitrixEmbeddedLoginHandler {
    constructor(
        private readonly identityResolver: BitrixIdentityResolver,
        private readonly sessionIssuer: AuthenticatedSessionIssuer,
    ) {}

    async execute(
        authId: string,
        memberId: string,
        domain: string,
    ): Promise<IssuedSession> {
        // `clientEndpoint` строится напрямую из `domain`, переданного
        // фронтендом вместе с AUTH_ID (см. bitrixEmbeddedLoginRequestSchema
        // в contracts/commands/auth.ts), а не через
        // `BitrixAuthService.getInstallation(memberId)` — та запись
        // (`BitrixInstallation`) создаётся только install-вебхуком
        // (`POST /bitrix/install`), который может не вызываться для
        // упрощённо зарегистрированного тестового приложения Bitrix24.
        // `memberId` больше не используется для похода в БД, но остаётся в
        // сигнатуре — идентификатор портала из того же ответа
        // `BX24.getAuth()`, пригодится для будущих сценариев (не
        // задействован в scope этой доработки).
        void memberId;
        const clientEndpoint = `https://${domain}/rest/`;
        const { bitrixEmployeeId } =
            await this.identityResolver.resolveBitrixEmployeeId(
                authId,
                clientEndpoint,
            );

        // Доставка session_id для embedded-контекста — заголовок
        // Authorization (spec: session#header-delivery-for-iframe),
        // cookie ненадёжны в iframe из-за SameSite/ITP.
        return this.sessionIssuer.issueSession(bitrixEmployeeId, 'header');
    }
}
