import { Injectable } from '@nestjs/common';
import { BitrixAuthService } from '@/integrations/bitrix/bitrix-auth.service';
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
        private readonly bitrixAuthService: BitrixAuthService,
        private readonly identityResolver: BitrixIdentityResolver,
        private readonly sessionIssuer: AuthenticatedSessionIssuer,
    ) {}

    async execute(authId: string, memberId: string): Promise<IssuedSession> {
        const installation = await this.bitrixAuthService.getInstallation(
            memberId,
        );
        const { bitrixEmployeeId } =
            await this.identityResolver.resolveBitrixEmployeeId(
                authId,
                installation.clientEndpoint,
            );

        // Доставка session_id для embedded-контекста — заголовок
        // Authorization (spec: session#header-delivery-for-iframe),
        // cookie ненадёжны в iframe из-за SameSite/ITP.
        return this.sessionIssuer.issueSession(bitrixEmployeeId, 'header');
    }
}
