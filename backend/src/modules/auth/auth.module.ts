import { Module } from '@nestjs/common';
import { BitrixModule } from '@/integrations/bitrix/bitrix.module';
import { BitrixSyncModule } from '@/sync/bitrix/bitrix-sync.module';
import { SessionModule } from '@/modules/session/session.module';
import { RolesModule } from '@/modules/roles/roles.module';
import { BITRIX_EMPLOYEE_LOOKUP_PORT } from './application/ports/bitrix-employee-lookup.port';
import { BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY } from './application/ports/bitrix-employee-credentials.port';
import { BitrixEmployeeLookupRepository } from './infrastructure/repositories/bitrix-employee-lookup.repository';
import { BitrixEmployeeCredentialsRepository } from './infrastructure/repositories/bitrix-employee-credentials.repository';
import { BitrixIdentityResolver } from './application/services/bitrix-identity-resolver.service';
import { BitrixTokenRefreshService } from './application/services/bitrix-token-refresh.service';
import { AuthenticatedSessionIssuer } from './application/services/authenticated-session-issuer.service';
import { BitrixEmbeddedLoginHandler } from './application/services/bitrix-embedded-login.handler';
import { BitrixOAuthLoginHandler } from './application/services/bitrix-oauth-login.handler';
import { BitrixEmbeddedLoginHttpController } from './interface/http-controllers/bitrix-embedded-login.http.controller';
import { BitrixOAuthCallbackHttpController } from './interface/http-controllers/bitrix-oauth-callback.http.controller';
import { GetCurrentUserHttpController } from './interface/http-controllers/get-current-user.http.controller';
import { LogoutHttpController } from './interface/http-controllers/logout.http.controller';

// Сквозной модуль аутентификации (add-bitrix24-auth-and-rbac) — владеет
// токенами Bitrix24 конкретного сотрудника, оркестрирует вход (design.md,
// Decision 1). НЕ владеет идентичностью — она уже есть (BitrixEmployee).
// Живёт вне domains/{service,shop}, по аналогии с
// src/modules/employee-identity. HTTP-контроллеры — раздел 12 tasks.md.
@Module({
    imports: [BitrixModule, BitrixSyncModule, SessionModule, RolesModule],
    controllers: [
        BitrixEmbeddedLoginHttpController,
        BitrixOAuthCallbackHttpController,
        GetCurrentUserHttpController,
        LogoutHttpController,
    ],
    providers: [
        {
            provide: BITRIX_EMPLOYEE_LOOKUP_PORT,
            useClass: BitrixEmployeeLookupRepository,
        },
        {
            provide: BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY,
            useClass: BitrixEmployeeCredentialsRepository,
        },
        BitrixIdentityResolver,
        BitrixTokenRefreshService,
        AuthenticatedSessionIssuer,
        BitrixEmbeddedLoginHandler,
        BitrixOAuthLoginHandler,
    ],
    exports: [
        BitrixIdentityResolver,
        BitrixTokenRefreshService,
        BitrixEmbeddedLoginHandler,
        BitrixOAuthLoginHandler,
    ],
})
export class AuthModule {}
