import { Module } from '@nestjs/common';
import { SESSION_PORT } from './application/ports/session.port';
import { SessionService } from './infrastructure/session.service';
import { SessionAuthGuard } from './interface/session-auth.guard';

// Сквозной модуль сессионного слоя (add-bitrix24-auth-and-rbac) — владеет
// Redis-сессиями (design.md, Decision 1). Живёт вне domains/{service,shop},
// по аналогии с src/modules/employee-identity. `SessionAuthGuard`
// экспортируется, но регистрируется как APP_GUARD только в
// `app.module.ts`, сознательно закомментировано до готовности frontend
// (design.md, Migration Plan шаг 6-7) — см. комментарий там.
@Module({
    providers: [
        SessionService,
        { provide: SESSION_PORT, useExisting: SessionService },
        SessionAuthGuard,
    ],
    exports: [SessionService, SESSION_PORT, SessionAuthGuard],
})
export class SessionModule {}
