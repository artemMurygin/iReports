import { Module } from '@nestjs/common';
import { SESSION_PORT } from './application/ports/session.port';
import { SessionService } from './infrastructure/session.service';
import { SessionAuthGuard } from './interface/session-auth.guard';
import { CsrfGuard } from './interface/csrf.guard';

// Сквозной модуль сессионного слоя (add-bitrix24-auth-and-rbac) — владеет
// Redis-сессиями (design.md, Decision 1). Живёт вне domains/{service,shop},
// по аналогии с src/modules/employee-identity. `SessionAuthGuard`/`CsrfGuard`
// экспортируются и уже применяются напрямую (`@UseGuards`) на новых
// эндпоинтах auth/roles (раздел 12-13 tasks.md), но глобальная регистрация
// как APP_GUARD в `app.module.ts` для ВСЕХ существующих роутов приложения
// сознательно закомментирована до готовности frontend (design.md, Migration
// Plan шаг 6-7) — см. комментарий там.
@Module({
    providers: [
        SessionService,
        { provide: SESSION_PORT, useExisting: SessionService },
        SessionAuthGuard,
        CsrfGuard,
    ],
    exports: [SessionService, SESSION_PORT, SessionAuthGuard, CsrfGuard],
})
export class SessionModule {}
