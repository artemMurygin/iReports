import { Module } from '@nestjs/common';
import { SESSION_PORT } from './application/ports/session.port';
import { SessionService } from './infrastructure/session.service';
import { SessionAuthGuard } from './interface/session-auth.guard';
import { CsrfGuard } from './interface/csrf.guard';
import { ApiKeyRepository } from './infrastructure/api-key.repository';
import { RegenerateApiKeyHttpController } from './interface/http-controllers/regenerate-api-key.http-controller';

// Сквозной модуль сессионного слоя (add-bitrix24-auth-and-rbac) — владеет
// Redis-сессиями (design.md, Decision 1). Живёт вне domains/{service,shop},
// по аналогии с src/modules/employee-identity. `SessionAuthGuard`/`CsrfGuard`
// экспортируются и уже применяются напрямую (`@UseGuards`) на новых
// эндпоинтах auth/roles (раздел 12-13 tasks.md), но глобальная регистрация
// как APP_GUARD в `app.module.ts` для ВСЕХ существующих роутов приложения
// сознательно закомментирована до готовности frontend (design.md, Migration
// Plan шаг 6-7) — см. комментарий там.
//
// add-employee-api-key-auth, раздел 6 tasks.md: единственный собственный HTTP-
// контроллер модуля — RegenerateApiKeyHttpController (POST
// /v1/auth/api-key/regenerate), см. design.md Decision 3. Маршрут лежит под
// /v1/auth/*, а не /v1/session/*, поэтому включён в тот же `@ApiTags`, что и
// остальные auth-эндпоинты (см. swagger.config.ts — SessionModule теперь тоже
// в `include` commonDocument).
//
// add-employee-api-key-auth, design.md Decision 3: ветка X-Api-Key внутри
// SessionAuthGuard резолвит permissions тем же PERMISSIONS_RESOLVER_PORT,
// которым владеет RolesModule. НЕ импортируем RolesModule сюда напрямую
// (что потребовало бы forwardRef() в обе стороны, т.к. RolesModule уже
// импортирует SessionModule ради SessionAuthGuard/CsrfGuard на своих
// контроллерах) — SessionAuthGuard используется через `@UseGuards()`
// НАПРЯМУЮ во многих модулях (auth, roles, work-schedule и т.д.), каждый из
// которых импортирует только SessionModule, а не RolesModule; Nest
// резолвит зависимости такого guard'а в области видимости МОДУЛЯ-
// ПОТРЕБИТЕЛЯ (см. WHY в session-auth.guard.ts), поэтому обычный
// constructor-DI для PERMISSIONS_RESOLVER_PORT заставил бы КАЖДЫЙ такой
// модуль дополнительно импортировать RolesModule. Вместо этого
// SessionAuthGuard резолвит порт лениво через ModuleRef.get(...,
// { strict: false }) — глобальный поиск по всему контейнеру приложения,
// не завязанный на локальную видимость модуля-потребителя (см. WHY там).
@Module({
    controllers: [RegenerateApiKeyHttpController],
    providers: [
        SessionService,
        { provide: SESSION_PORT, useExisting: SessionService },
        ApiKeyRepository,
        SessionAuthGuard,
        CsrfGuard,
    ],
    exports: [
        SessionService,
        SESSION_PORT,
        ApiKeyRepository,
        SessionAuthGuard,
        CsrfGuard,
    ],
})
export class SessionModule {}
