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
import {
    BOOTSTRAP_ADMIN_PORT,
    type BootstrapAdminPort,
} from '../../../roles/application/ports/bootstrap-admin.port';
import { BitrixTokenRefreshService } from './bitrix-token-refresh.service';
import { BitrixPortalAdminCheckService } from '@/integrations/bitrix/auth/portal-admin-check.service';

export interface IssuedSession {
    sessionId: string;
    delivery: SessionDelivery;
}

// Общий "хвост" обоих сценариев входа (embedded/OAuth) после того, как
// bitrixEmployeeId уже резолвлен и подтверждён BitrixIdentityResolver:
// bootstrap первого администратора (design.md, Decision 9, раздел 11
// tasks.md) → посчитать permissions → выдать сессию. Вынесено в отдельный
// сервис, чтобы bootstrap правился в ОДНОМ месте, а не в обоих
// login-хендлерах.
@Injectable()
export class AuthenticatedSessionIssuer {
    constructor(
        @Inject(PERMISSIONS_RESOLVER_PORT)
        private readonly permissionsResolver: PermissionsResolverPort,
        @Inject(SESSION_PORT)
        private readonly sessionPort: SessionPort,
        @Inject(BOOTSTRAP_ADMIN_PORT)
        private readonly bootstrapAdminPort: BootstrapAdminPort,
        private readonly tokenRefreshService: BitrixTokenRefreshService,
        private readonly portalAdminCheckService: BitrixPortalAdminCheckService,
    ) {}

    async issueSession(
        bitrixEmployeeId: number,
        delivery: SessionDelivery,
    ): Promise<IssuedSession> {
        await this.bootstrapAdministratorIfNeeded(bitrixEmployeeId);

        const permissions =
            await this.permissionsResolver.resolvePermissions(bitrixEmployeeId);
        const { sessionId } = await this.sessionPort.createSession(
            bitrixEmployeeId,
            permissions,
            delivery,
        );
        return { sessionId, delivery };
    }

    // design.md, Decision 9: при логине сотрудника, у которого ещё нет ни
    // одной роли, вызывает Bitrix24 REST user.admin с ТОКЕНОМ САМОГО
    // ВОШЕДШЕГО СОТРУДНИКА (тот же приём, что BitrixPortalAdminCheckService
    // использует для проверки администратора портала) — если он админ
    // портала, назначает системную роль Administrator ДО того, как
    // permissions будут посчитаны, чтобы новые права отразились в этой же
    // сессии без релогина. Сотрудникам с уже назначенной ролью REST-вызов
    // не выполняется вовсе — избегает лишней сетевой зависимости на
    // подавляющем большинстве входов.
    private async bootstrapAdministratorIfNeeded(
        bitrixEmployeeId: number,
    ): Promise<void> {
        const hasAnyRole =
            await this.bootstrapAdminPort.hasAnyRole(bitrixEmployeeId);
        if (hasAnyRole) {
            return;
        }

        const accessToken =
            await this.tokenRefreshService.getValidAccessToken(
                bitrixEmployeeId,
            );
        const isPortalAdmin =
            await this.portalAdminCheckService.isPortalAdmin(accessToken);
        if (!isPortalAdmin) {
            return;
        }

        await this.bootstrapAdminPort.assignAdministratorRole(bitrixEmployeeId);
    }
}
