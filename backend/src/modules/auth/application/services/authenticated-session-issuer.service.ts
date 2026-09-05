import { Inject, Injectable } from '@nestjs/common';
import {
    PERMISSIONS_RESOLVER_PORT,
    type PermissionsResolverPort,
} from '../../../roles/application/ports/permissions-resolver.port';
import {
    SESSION_PORT,
    type SessionDelivery,
    type SessionPort,
} from '../../../session/application/ports/session.port';

export interface IssuedSession {
    sessionId: string;
    delivery: SessionDelivery;
}

// Общий "хвост" обоих сценариев входа (embedded/OAuth) после того, как
// bitrixEmployeeId уже резолвлен и подтверждён BitrixIdentityResolver:
// посчитать permissions и выдать сессию. Вынесено в отдельный сервис,
// чтобы bootstrap первого администратора (design.md, Decision 9, раздел 11
// tasks.md) правился в ОДНОМ месте, а не в обоих login-хендлерах.
@Injectable()
export class AuthenticatedSessionIssuer {
    constructor(
        @Inject(PERMISSIONS_RESOLVER_PORT)
        private readonly permissionsResolver: PermissionsResolverPort,
        @Inject(SESSION_PORT)
        private readonly sessionPort: SessionPort,
    ) {}

    async issueSession(
        bitrixEmployeeId: number,
        delivery: SessionDelivery,
    ): Promise<IssuedSession> {
        const permissions =
            await this.permissionsResolver.resolvePermissions(bitrixEmployeeId);
        const { sessionId } = await this.sessionPort.createSession(
            bitrixEmployeeId,
            permissions,
            delivery,
        );
        return { sessionId, delivery };
    }
}
