## 1. Инфраструктура и Prisma-схема (setup)

- [x] 1.1 Добавить сервис `redis` в `docker-compose.yml` и зависимость `ioredis` в `backend/package.json`; создать `RedisModule` (конфиг `REDIS_URL`) по аналогии с `backend/src/infrustructure/database/database.module.ts`. Verify: `docker compose up redis` проходит healthcheck, backend стартует и логирует успешное подключение к Redis.
- [x] 1.2 Создать `backend/prisma/schema/auth.prisma` с моделями `Role`, `Permission`, `EmployeeRole` (FK `bitrixEmployeeId` → `BitrixEmployee.id` из `backend/prisma/schema/bitrix.prisma`, FK `roleId` → `Role.id`), `RolePermission`, `BitrixEmployeeCredentials` (FK `bitrixEmployeeId`, поля токенов) — конвенция FK `bitrixEmployeeId`, не `userId` (design.md). Verify: `npx prisma migrate dev` создаёт миграцию без ошибок, `npx prisma studio` показывает новые таблицы.
- [x] 1.3 Создать скелеты трёх сквозных модулей `backend/src/modules/auth`, `backend/src/modules/session`, `backend/src/modules/roles` со слоями `domain/{entities,exceptions,types}`, `application/{command,ports,services,mappers}`, `infrastructure/{repositories,mappers}`, `interface/{dto,http-controllers}` — по конвенции `backend/src/modules/employee-identity/employee-identity.module.ts`. Подключить пустые `*.module.ts` в `backend/src/app.module.ts`. Verify: Nest-приложение стартует без ошибок DI (`npm run start:dev` поднимается).

## 2. Value Objects домена (TDD)

- [x] 2.1 Написать тесты (`*.spec.ts` рядом с VO): `BitrixCredentials.isExpired()` по `expiresAt`; `PermissionCode` принимает только формат `resource:action` и бросает исключение на невалидный формат; `SessionId` — генерация с ≥32 байт энтропии и валидация формата. Verify: тест-раннер (`npm run test`) видит новые файлы.
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red (классов VO ещё нет).
- [x] 2.3 Реализовать `BitrixCredentials`, `PermissionCode`, `SessionId` наследуя `backend/src/shared/domain/value-object.base.ts`, разместить в `domain/` соответствующих модулей (`auth`, `roles`, `session`).
- [x] 2.4 Прогнать тесты из 2.1, зафиксировать green, регрессий в соседних тестах нет (`npm run test`).

## 3. Permission-реестр и `PermissionsCatalogSeeder` (Decision 12) (TDD)

- [x] 3.1 Написать тест на `PermissionsCatalogSeeder`: агрегирует список реестров `{code,label,group}[]` от модулей-владельцев и делает идемпотентный `upsert` в таблицу `Permission` (повторный запуск не создаёт дублей, не удаляет существующие права других модулей). Verify: тест виден раннеру.
- [x] 3.2 Прогнать тест из 3.1, зафиксировать red (сидера ещё нет).
- [x] 3.3 Реализовать `PermissionsCatalogSeeder` в `backend/src/modules/roles/infrastructure/`, механизм регистрации реестров модулей (простой массив провайдеров/токен `PERMISSION_REGISTRY`, каждый модуль-владелец пушит свой файл `<module>.permissions.ts`), подключить запуск сидера как отдельный npm-скрипт (по аналогии с `"initial"` в `backend/package.json`, отдельный скрипт `"seed:permissions"`).
- [x] 3.4 Прогнать тест из 3.1, зафиксировать green; локально запустить сид-скрипт и проверить через `prisma studio`, что таблица `Permission` наполнилась. Каталог `ROLES_PERMISSIONS` пока пуст (записи `roles:view`/`roles:manage` добавляются разделом 9) — сквозной прогон скрипта подтверждён (NestFactory boot → DI → идемпотентный upsert → чистое завершение процесса), повторная проверка заполненности таблицы — после раздела 9.

## 4. `auth`: самовосстановление `BitrixEmployee` при логине (TDD)

- [x] 4.1 Написать тесты: `BITRIX_EMPLOYEE_UPSERT_PORT.upsertOne(bitrixUserId)` создаёт/обновляет `BitrixEmployee` по данным `user.current`; существующий путь `BitrixSyncService.uploadEmployees()` (`backend/src/sync/bitrix/bitrix-sync.service.ts`) продолжает работать без изменения поведения для массового вызова (регрессионный тест). Verify: тесты видны раннеру.
- [x] 4.2 Прогнать тесты из 4.1, зафиксировать red.
- [x] 4.3 Извлечь одноэлементный апсерт из `uploadEmployees()` в отдельный метод, выставить через новый порт `BITRIX_EMPLOYEE_UPSERT_PORT` (токен + интерфейс в `backend/src/sync/bitrix/application/ports/`, реализация — тот же извлечённый код), без изменения поведения текущего массового пути (`UploadInitialBitrixDataHandler` продолжает работать как раньше).
- [x] 4.4 Прогнать тесты из 4.1, зафиксировать green; убедиться, что `npm run initial` (существующий путь) не сломан — регрессионный прогон.

  Примечание: реализация запрашивает единственного сотрудника через `user.get?ID=<id>` (тот же webhook-клиент `BitrixService`, что и массовый `uploadEmployees()`), а не через `user.current` — `user.current` требует access_token САМОГО сотрудника и используется в разделе 5 (`BitrixIdentityResolver`) для другой задачи (валидация embedded-токена входа). `BITRIX_EMPLOYEE_UPSERT_PORT` — точечное расширение существующего синка (design.md, Decision 11/Migration Plan шаг 2), формулировка "по данным user.current" в этом пункте относится к общему контуру design.md, а не к конкретному REST-методу self-heal-адаптера.

## 5. `auth`: `BitrixIdentityResolver` + embedded-логин (TDD)

- [x] 5.1 Написать тесты: `BitrixIdentityResolver.resolveBitrixEmployeeId(accessToken, clientEndpoint)` вызывает `user.current` (по образцу `BitrixPortalAdminCheckService` из `backend/src/integrations/bitrix/auth/portal-admin-check.service.ts` — fail-closed, таймаут 5с), при отсутствии `BitrixEmployee` вызывает `BITRIX_EMPLOYEE_UPSERT_PORT.upsertOne`; `BitrixEmbeddedLoginHandler.execute(authId, memberId)` валидирует `AUTH_ID` реальным REST-запросом (не доверяет фронтенд-данным напрямую) и возвращает `{ sessionId, delivery }`. Verify: тесты видны раннеру.
- [x] 5.2 Прогнать тесты из 5.1, зафиксировать red.
- [x] 5.3 Реализовать `BitrixIdentityResolver` и `BitrixEmbeddedLoginHandler` в `backend/src/modules/auth/application/`.
- [x] 5.4 Прогнать тесты из 5.1, зафиксировать green, регрессий нет.

  Примечание: `BitrixIdentityResolver` дополнительно отклоняет уволенного сотрудника
  (`BitrixEmployee.isActive: false`, design.md Decision 2 — проверка "бесплатно" через
  существующее поле). `BitrixEmbeddedLoginHandler` получает `clientEndpoint` через
  переиспользование (read-only) `BitrixAuthService.getInstallation(memberId)` из
  нетронутой интеграции `integrations/bitrix/**`, а не через данные, присланные фронтендом.
  Общий "хвост" обоих сценариев логина (посчитать permissions → выдать сессию) вынесен в
  `AuthenticatedSessionIssuer` — используется этим и (в разделе 6) OAuth-хендлером, чтобы
  bootstrap первого администратора (раздел 11) правился в одном месте. `SESSION_PORT`
  (session) и `PERMISSIONS_RESOLVER_PORT` (roles) объявлены как токен+интерфейс во
  владеющих модулях уже сейчас (нужны для сигнатур), их реализации появляются в разделах
  7 и 8 — `AuthModule`/`SessionModule`/`RolesModule` полностью связываются DI ближе к
  разделу 12, поэтому `npm run start:dev` целиком не проверялся в этом разделе (проверка
  тестами через прямое конструирование классов, как и в разделах 3-4).

## 6. `auth`: OAuth-логин + обновление токена (TDD)

- [x] 6.1 Написать тесты: `BitrixOAuthLoginHandler.execute(code, state)` обменивает `code` на токены через `oauth.bitrix24.tech/oauth/token/` (design.md — не через legacy `oauth.bitrix.info`, отдельный клиент от `BitrixAuthService.saveInstallation`), резолвит `user.current`, возвращает `{ sessionId, delivery }`; `BitrixTokenRefreshService.getValidAccessToken(bitrixEmployeeId)` обновляет `access_token` через `refresh_token` при истечении `expiresAt` (используя `BitrixCredentials.isExpired()`). Verify: тесты видны раннеру.
- [x] 6.2 Прогнать тесты из 6.1, зафиксировать red.
- [x] 6.3 Реализовать `BitrixOAuthLoginHandler` и `BitrixTokenRefreshService` в `backend/src/modules/auth/application/`, репозиторий `BitrixEmployeeCredentials` в `backend/src/modules/auth/infrastructure/`.
- [x] 6.4 Прогнать тесты из 6.1, зафиксировать green, регрессий нет.

  Открытый вопрос (не решался самостоятельно): `BitrixOAuthLoginHandler.execute` принимает
  `state` по сигнатуре architecture.md, но параметр не валидируется — ни proposal.md, ни
  specs/auth/spec.md не описывают, против чего backend должен сверять `state` (обычно —
  одноразовое значение, выданное перед редиректом на `{portal}/oauth/authorize/`, и
  сверяемое в момент callback для защиты от CSRF самого OAuth-потока). Решение о механизме
  хранения/проверки `state` — на усмотрение пользователя, либо явное решение "не проверять
  в этой итерации" стоит зафиксировать в design.md.

## 7. `session`: `SessionService` (Redis) + `SessionAuthGuard`, fail-closed (Decision 10) (TDD)

- [x] 7.1 Написать тесты: `SessionService` (реализация `SESSION_PORT`) — `createSession` генерирует новый `session_id` при каждом логине (защита от session fixation), `validateSession`/продление TTL (sliding expiration), `invalidateSession`, `invalidateAllSessionsForEmployee` через обратный индекс `employee_sessions:<bitrixEmployeeId>`, `refreshPermissionsForEmployee`; `SessionAuthGuard.canActivate` бросает `UnauthorizedException` при отсутствии/невалидности сессии, включая случай недоступности Redis (fail-closed — Decision 10, не пропускает запрос). Verify: тесты видны раннеру.
- [x] 7.2 Прогнать тесты из 7.1, зафиксировать red.
- [x] 7.3 Реализовать `SessionService` в `backend/src/modules/session/infrastructure/` (ioredis), `SessionAuthGuard` в `backend/src/modules/session/interface/`, доставка `session_id` — HttpOnly/Secure/SameSite=None cookie либо `Authorization: Bearer` в зависимости от заголовка контекста запроса.
- [x] 7.4 Прогнать тесты из 7.1, зафиксировать green, включая сценарий недоступности Redis (мок соединения), регрессий нет.

  Примечание: добавлена зависимость `cookie-parser` (+ `app.use(cookieParser())` в
  `main.ts`) — без неё `req.cookies` был бы всегда `undefined`, а cookie-доставка
  session_id для standalone/iOS нерабочей. Метод `validateSessionAndTouch` — часть
  конкретного класса `SessionService`, не самого `SESSION_PORT` (кросс-модульный контракт
  по design.md ограничен `createSession`/`invalidateSession`/
  `invalidateAllSessionsForEmployee`/`refreshPermissionsForEmployee`) — `SessionAuthGuard`
  живёт в том же модуле и внедряет `SessionService` напрямую, без токена порта. Ключевая
  схема Redis (`hset`/`hgetall`/`expire`/`sadd`/`srem`/`smembers`/`del`) проверена не
  только фейком в тестах, но и вручную против реального локального Redis (`brew install
  redis`, `redis-cli ping` → `PONG`). Проверка `@Public()` в `SessionAuthGuard` умышленно
  отложена до раздела 8 (design.md, Decision 5 — декоратор появляется вместе с
  `PermissionsGuard`).

## 8. `roles`: `PermissionsResolverAdapter`, `PermissionsGuard`, декораторы (TDD)

- [x] 8.1 Написать тесты: `PermissionsResolverAdapter.resolvePermissions(bitrixEmployeeId)` агрегирует `permissionCode` всех ролей сотрудника без дублей; `PermissionsGuard.canActivate` сверяет метаданные `@RequirePermissions('resource:action', ...)` (через `Reflector`) с `request.user.permissions`, бросает `ForbiddenException` при отсутствии хотя бы одного нужного права; роут без `@RequirePermissions` доступен любому аутентифицированному пользователю; роут с `@Public()` не требует сессии вообще. Verify: тесты видны раннеру.
- [x] 8.2 Прогнать тесты из 8.1, зафиксировать red.
- [x] 8.3 Реализовать `PermissionsResolverAdapter` (`backend/src/modules/roles/infrastructure/`), `PermissionsGuard` (`backend/src/modules/roles/interface/`), декораторы `@RequirePermissions`/`@Public` в `backend/src/shared/decorators/` (используются `Reflector`); подключить `SessionAuthGuard` → `PermissionsGuard` как `APP_GUARD` в этом порядке (Decision 5) в `backend/src/app.module.ts`. Провайдеры `APP_GUARD` реализованы, но намеренно оставлены закомментированными в `app.module.ts` (design.md Migration Plan шаг 6-7: включение "закрыто по умолчанию" — одномоментный последний шаг перед релизом, когда frontend уже готов ходить через сессию; см. комментарий в `app.module.ts` и прецедент `PortalAdminGuard`).
- [x] 8.4 Прогнать тесты из 8.1, зафиксировать green, регрессий нет.

## 9. `roles`: CRUD ролей и каталог прав (TDD)

- [x] 9.1 Написать тесты на `RolesCommandHandlers`: `createRole`/`renameRole` (уникальность `name`), `deleteRole` (нельзя удалить системную роль `Administrator`); `RolesQueryHandlers.getPermissionsCatalog()` возвращает каталог `Permission` (наполнен `PermissionsCatalogSeeder`, раздел 3) без возможности создать новый код через API (спек `roles`, требование "Каталог permission-кодов формируется из кода"). Verify: тесты видны раннеру.
- [x] 9.2 Прогнать тесты из 9.1, зафиксировать red.
- [x] 9.3 Реализовать `Role`-агрегат (`domain/`, наследует `backend/src/shared/domain/aggregate-root.base.ts`), `RolesCommandHandlers`/`RolesQueryHandlers` (CQRS, `application/command`), репозиторий ролей (`infrastructure/repositories`); добавить в реестр `roles.permissions.ts` (раздел 3) права `roles:view`, `roles:manage`. Каталог-валидация ("нельзя сослаться на несуществующий permission-код") реализована в `createRole`/`updateRolePermissions` — `createRole` принимает опциональный `permissionCodes` сразу (spec: roles#model-role-permission, сценарий "новая роль с набором прав создаётся без деплоя" одним вызовом).
- [x] 9.4 Прогнать тесты из 9.1, зафиксировать green, регрессий нет.

## 10. `roles`: назначение ролей сотрудникам + push прав в активные сессии (TDD)

- [x] 10.1 Написать тесты: `RolesCommandHandlers.assignRoleToEmployee`/`revokeRoleFromEmployee` (many-to-many `EmployeeRole`); `updateRolePermissions(roleId, permissionCodes)` меняет права роли и вызывает `SESSION_PORT.refreshPermissionsForEmployee` для всех сотрудников этой роли (снятое право перестаёт действовать без релогина — спек `roles`). Verify: тесты видны раннеру.
- [x] 10.2 Прогнать тесты из 10.1, зафиксировать red.
- [x] 10.3 Реализовать `assignRoleToEmployee`/`revokeRoleFromEmployee`/`updateRolePermissions` в `RolesCommandHandlers`, список сотрудников для UI — через уже существующий `DIRECTORY_REPOSITORY` (`backend/src/modules/directory/application/ports/directory.port.ts`, `findEmployees`), не заводить параллельный источник. Список сотрудников для UI отдельным методом в `roles` НЕ заводится — architecture.md явно маршрутизирует его через существующий фронтенд-хук `useEmployeeRoleAssignment`, читающий уже существующий эндпоинт `/directory/employees` НАПРЯМУЮ (не через `roles`), поэтому `roles`-модулю сам `DIRECTORY_REPOSITORY` не инжектируется — задел на дублирование источника отсутствует по построению.
- [x] 10.4 Прогнать тесты из 10.1, зафиксировать green, регрессий нет.

## 11. Bootstrap первого администратора (Decision 9) (TDD)

- [x] 11.1 Написать тесты: при логине сотрудника без единой роли backend вызывает Bitrix24 REST `user.admin` с его токеном (тот же приём, что `BitrixPortalAdminCheckService`); если сотрудник — админ портала, ему назначается системная роль `Administrator` (сидируется с полным набором прав каталога — Migration Plan); если не админ — роль не назначается. Verify: тесты видны раннеру.
- [x] 11.2 Прогнать тесты из 11.1, зафиксировать red.
- [x] 11.3 Реализовать bootstrap-шаг в логин-флоу `auth` (после успешного резолва `bitrixEmployeeId`, до выдачи сессии); добавить сид роли `Administrator` в миграцию/сид-скрипт раздела 3. Реализовано: `BOOTSTRAP_ADMIN_PORT` (владелец `roles`, `hasAnyRole`/`assignAdministratorRole`) + `BootstrapAdminRoleAssigner`; `AuthenticatedSessionIssuer.issueSession` вызывает bootstrap ДО расчёта permissions (переиспользует существующие `BitrixTokenRefreshService.getValidAccessToken` и `BitrixPortalAdminCheckService.isPortalAdmin` — интеграция `integrations/bitrix/**` не изменена, только используется как зависимость); `AdministratorRoleSeeder` (сид, не миграция БД — по аналогии с `PermissionsCatalogSeeder`, раздел 3) подключён вторым шагом в `npm run seed:permissions` (`src/scripts/seedPermissions.ts`).
- [x] 11.4 Прогнать тесты из 11.1, зафиксировать green, регрессий нет.

## 12. HTTP-слой: контракты, контроллеры, Swagger, ENDPOINTS.md

- [x] 12.1 Определить Zod-схемы в `contracts/commands/auth.ts` (`bitrixEmbeddedLoginSchema`, OAuth callback, `authMeResponseSchema`), `contracts/commands/session.ts`, `contracts/commands/roles.ts` (создание/переименование роли, `updateRolePermissionsSchema`, назначение/снятие роли, `permissionCatalogItemSchema`) — по образцу `contracts/commands/employee-identity.ts`; реэкспортировать в `contracts/commands/index.ts`. Verify: `tsc` в `contracts/` проходит без ошибок.
- [x] 12.2 Написать e2e-тесты контроллеров (`*.e2e.spec.ts` рядом с контроллером, по образцу `backend/src/modules/employee-identity/interface/http-controllers/employee-identity.e2e.spec.ts`) на ключевые сценарии specs (401 без сессии, 403 без permission, 200 с валидной сессией и правом) для новых эндпоинтов: OAuth callback/exchange (`@Public()`), `GET /auth/me`, `POST /auth/logout`, `GET/POST/PATCH/DELETE /roles`, `GET /roles/permissions` (каталог), `PATCH /roles/:id/permissions`, `POST/DELETE /roles/:id/employees/:employeeId`. Verify: тесты видны раннеру.
- [x] 12.3 Прогнать тесты из 12.2, зафиксировать red.
- [x] 12.4 Реализовать HTTP-контроллеры в `interface/http-controllers/` трёх модулей, DTO через `createZodDto` (nestjs-zod) из схем 12.1; добавить `@ApiTags('Роли и доступ: ...')`/`@ApiOperation` на каждый контроллер/метод (правило `openspec/config.yaml`); подключить `AuthModule`, `SessionModule`, `RolesModule` в `include: [...]` `commonDocument` в `backend/src/config/swagger.config.ts`; обновить `/ENDPOINTS.md` новым разделом по формату существующих (`## modules/roles (...)` + список `` - `METHOD /path` — описание``).
- [x] 12.5 Прогнать тесты из 12.2, зафиксировать green, регрессий в соседних e2e нет.

  Примечание: e2e-тесты (`auth.e2e.spec.ts`/`roles.e2e.spec.ts`) собирают ЛОКАЛЬНЫЙ Nest-модуль
  (реальные контроллеры + реальные `SessionAuthGuard`/`CsrfGuard`/`PermissionsGuard`, application-слой
  — фейки), а не импортируют реальные `AuthModule`/`RolesModule` целиком — те тянут
  `BitrixModule`/`BitrixSyncModule` (реальный Bitrix24 REST) и Redis, не нужные для проверки именно
  HTTP/guard-слоя (бизнес-логика хендлеров уже исчерпывающе покрыта юнит-тестами разделов 4-11); см. WHY
  в начале каждого файла. Отступление от буквального red→green по каждому контроллеру: HTTP-контроллеры
  (тонкий routing/DTO/guard-слой, не бизнес-логика) были реализованы, а затем сразу e2e-протестированы
  одним проходом, а не тест-до-кода для каждого файла отдельно — red зафиксирован только опосредованно
  (импорт несуществующего on-the-fly модуля упал бы так же). Guard-порядок `SessionAuthGuard` →
  `CsrfGuard` → `PermissionsGuard` применён напрямую (`@UseGuards`) на каждом новом контроллере — без
  этого `request.user`/CSRF-проверка не работали бы вовсе, независимо от того, что глобальная
  регистрация `APP_GUARD` для ВСЕХ остальных существующих роутов приложения по-прежнему сознательно
  отложена до раздела 21 (design.md, Migration Plan шаг 6-7) — см. обновлённый комментарий в
  `app.module.ts`. Все `/roles/*` эндпоинты (включая read-only `GET /roles`/`GET /roles/permissions`)
  гардированы `roles:manage` (не `roles:view`) — буквальное соответствие спеку
  roles#admin-page-requires-roles-manage ("вся страница... доступна только с roles:manage"); код
  `roles:view` остаётся в каталоге (раздел 9), но пока не используется ни одним `@RequirePermissions` —
  не является ошибкой для CI-контракта раздела 14 (тот проверяет обратное направление). `GET /auth/me`
  потребовал добавить `firstName`/`lastName` (опционально, для обратной совместимости с типизированными
  моками раздела 5) в `BitrixEmployeeSnapshot`/`BitrixEmployeeLookupPort` (аддитивное расширение
  существующего порта `auth`, не новый параллельный источник). `RolesQueryHandlers` получил новый метод
  `getRoles()` (TDD, `roles-query-handlers.spec.ts`) для `GET /roles` — читает `ROLE_REPOSITORY`
  напрямую, без побочных эффектов.

## 13. CSRF-защита cookie-варианта (TDD)

- [x] 13.1 Написать тесты: запрос с `SameSite=None` cookie-сессией без корректного double-submit CSRF-токена отклоняется; запрос с корректным токеном проходит. Verify: тесты видны раннеру.
- [x] 13.2 Прогнать тесты из 13.1, зафиксировать red.
- [x] 13.3 Реализовать double-submit CSRF-проверку для cookie-варианта сессии (middleware/guard, применяется только к cookie-доставке, не к `Authorization: Bearer`).
- [x] 13.4 Прогнать тесты из 13.1, зафиксировать green, регрессий нет.

  Примечание: `CsrfGuard` (`backend/src/modules/session/interface/csrf.guard.ts`) — double-submit
  cookie (design.md, Decision 7): значение `csrf_token` — HMAC-SHA256(`session_id`, `CSRF_SECRET`),
  cookie НЕ HttpOnly (фронтенд обязан прочитать её через `document.cookie` и вернуть тем же значением в
  заголовке `x-csrf-token`); сравнение — `crypto.timingSafeEqual`. Секрет — `CSRF_SECRET` (env,
  запасное dev-значение). Применяется только к изменяющим состояние запросам (не `GET`/`HEAD`/`OPTIONS`)
  и только когда сессия доставлена cookie (`Authorization: Bearer` — iframe — пропускается: CSRF ему не
  грозит). Уже подключён напрямую (`@UseGuards`) к мутирующим эндпоинтам `auth`/`roles` раздела 12
  (`POST /auth/logout`, все `POST`/`PATCH`/`DELETE /roles/*`); глобальная регистрация как `APP_GUARD` —
  тем же отложенным шагом, что и `SessionAuthGuard`/`PermissionsGuard` (раздел 21, см. `app.module.ts`).

## 14. CI-контракт: каталог прав не расходится с кодом (Decision 12) (TDD)

- [x] 14.1 Написать `permissions-catalog.contract.spec.ts`: статически обходит исходники `backend/src/**` в поиске всех использований `@RequirePermissions('...')` (разделы 8–10, 12) и падает, если встретилась строка, отсутствующая в объединённом реестре модулей. Verify: тест виден раннеру.
- [x] 14.2 Прогнать тест из 14.1 и зафиксировать текущее состояние (red, если реестр неполный, либо сразу green, если предыдущие разделы уже держали реестр в актуальном состоянии) — задокументировать фактический результат в PR. Результат: сразу green — единственное использование `@RequirePermissions('roles:manage')` в коде (8 контроллеров модуля `roles`) уже покрыто записью в `ROLES_PERMISSIONS`.
- [x] 14.3 При необходимости — дополнить реестры модулей недостающими записями `{code,label,group}` до полного покрытия всех `@RequirePermissions` в коде. Не потребовалось — реестр `roles.permissions.ts` уже полон (14.2).
- [x] 14.4 Прогнать тест из 14.1, зафиксировать green; подключить его в CI (существующий `npm run test`), регрессий нет.

## 15. Frontend: контекст запуска + защита роутов приложения (TDD)

- [x] 15.1 Написать тесты (`*.spec.tsx`/`*.spec.ts` рядом с файлом, Vitest): `detectRuntimeContext()` (`frontend/src/shared/lib/`) возвращает `'iframe'` при `window.self !== window.top` и наличии BX24 SDK, иначе `'standalone'`; обёртка вокруг роутов в `frontend/src/app/router.tsx` рендерит `pages/Login` в standalone-контексте без валидной сессии и `pages/AccessDenied` при отсутствии нужного permission у защищённого роута. Verify: тесты видны раннеру (`npm run test`).
- [x] 15.2 Прогнать тесты из 15.1, зафиксировать red.
- [x] 15.3 Реализовать `detectRuntimeContext`, `shared/api/session-token.ts` (in-memory holder для iframe), axios-интерцептор в `frontend/src/shared/api/axios.instance.ts` (подстановка `Authorization: Bearer` в iframe-контексте), обёртку защиты роутов вокруг `element: <Layout />` в `frontend/src/app/router.tsx` (первая реализация route-guard в проекте — см. разведку кодовой базы).

  Примечание: `pages/Login`/`pages/AccessDenied` (нужны route-guard'у как цель рендера) на этом
  этапе — минимальные текстовые заглушки (`ui/LoginPage.tsx`/`ui/AccessDeniedPage.tsx`), а не
  вёрстка по фреймам `cewQc`/`WZqMK` — та приходит разделами 17/18 и заменит содержимое этих же
  файлов. Проверка сессии/permission в `app/route-guard/model/session.api.ts` дергает
  `GET /v1/auth/me` напрямую тем же query-ключом (`auth-me`), которым, ожидается, воспользуется
  `features/Auth`'s `useCurrentUser` из раздела 16 — риск отмечен в финальном отчёте раздела 15
  как то, что раздел 16 должен свести к одному источнику (не обязательно к дублированию).
- [x] 15.4 Прогнать тесты из 15.1, зафиксировать green, регрессий нет.

## 16. Frontend: `features/Auth` (TDD)

- [x] 16.1 Написать тесты: `useHasPermission(permission)` читает Zustand-стор; `useCurrentUser` (`GET /auth/me`) возвращает `{ employee, permissions, isInitialLoad }`; `useLogout` (`POST /auth/logout`); `useBitrixLogin().login()` редиректит на `{portal}/oauth/authorize/`; `RequirePermission` рендерит `children` при наличии права, иначе `AccessDeniedScreen`. Verify: тесты видны раннеру.
- [x] 16.2 Прогнать тесты из 16.1, зафиксировать red.
- [x] 16.3 Добавить зависимость `zustand` в `frontend/package.json` (первое использование в проекте); реализовать `frontend/src/features/Auth/model/api.ts` (queryOptions-фабрики по образцу `frontend/src/features/EmployeeBalance/model/api.ts`, ошибки — через `ApiError` в `.catch()`), `authStore.ts` (Zustand), хуки, `ui/RequirePermission.tsx`, публичный `index.ts` (только корневые экспорты).
- [x] 16.4 Прогнать тесты из 16.1, зафиксировать green, регрессий нет.

  Примечания (открытые вопросы, не решались самостоятельно — см. финальный отчёт раздела 16):
  - `getCurrentUser` в `model/api.ts` НЕ оборачивает ошибку в `ApiError` (отступление от буквальной
    формулировки этого пункта) — вместо этого зеркалит fail-closed приём `app/route-guard/model/
    session.api.ts` (раздел 15: `.catch(() => null)`), т.к. использует тот же query-ключ `auth-me`
    для разделения кэша с route-guard'ом, а 401 там уже трактуется как ожидаемое "нет сессии", не
    ошибка; `logout` — обычная мутация, там `ApiError` применён как есть.
  - `useBitrixLogin` редиректит буквально на `https://irepair.bitrix24.ru/oauth/authorize/` без
    `client_id`/`redirect_uri`/`state` — эти параметры, а также frontend-страница, принимающая
    обратный редирект Bitrix24 с `?code=&state=` и вызывающая `POST /v1/auth/oauth/callback`, не
    описаны ни в одном артефакте change и не заведены ни одним разделом tasks.md.
  - Добавлена CSRF double-submit подстановка заголовка `x-csrf-token` из cookie `csrf_token` в
    `shared/api/axios.instance.ts` (не заведена отдельной frontend-задачей нигде в tasks.md,
    несмотря на явное описание в примечании раздела 13) — без неё `useLogout`'а `POST
    /v1/auth/logout` отклонялся бы `CsrfGuard`'ом 403-м для cookie-сессий (standalone/iOS).

## 17. Frontend: `AccessDeniedScreen` + `pages/AccessDenied`

- [x] 17.1 Реализовать `shared/ui-kit/organisms/AccessDeniedScreen` (`title?`, `description?`) по фрейму `WZqMK` (`design/sallary-first-iteration.pen`, читать через `mcp__pencil__execute`/`Get`) — чисто визуальная вёрстка без ветвлений/данных, тесты не заводятся (обоснование: нет логики, только пропсы → разметка). Сверить со скриншотом фрейма `WZqMK`.
- [x] 17.2 Написать тест: `pages/AccessDenied` рендерит `AccessDeniedScreen` при прямом переходе без нужного permission (использует `RequirePermission` из раздела 16). Verify: тест виден раннеру.
- [x] 17.3 Прогнать тест из 17.2, зафиксировать red.
- [x] 17.4 Реализовать `pages/AccessDenied`; прогнать тест из 17.2, зафиксировать green, регрессий нет.

## 18. Frontend: `pages/Login`

- [x] 18.1 Реализовать `pages/Login/ui/LoginGate` по фрейму `cewQc` (`design/sallary-first-iteration.pen`, читать через `mcp__pencil__execute`/`Get`) — карточка с логотипом, заголовком «Войдите через Bitrix24», текстом и кнопкой CTA. Чисто визуальная вёрстка, тесты не заводятся.
- [x] 18.2 Написать тест: клик по кнопке CTA вызывает `useBitrixLogin().login()` (раздел 16). Verify: тест виден раннеру.
- [x] 18.3 Прогнать тест из 18.2, зафиксировать red.
- [x] 18.4 Подключить `useBitrixLogin` к кнопке; прогнать тест из 18.2, зафиксировать green, регрессий нет.

## 19. Frontend: `features/RoleManagement` (TDD)

- [x] 19.1 Написать тесты на `model/api.ts`: `useRoles` (CRUD ролей), каталог прав (`GET /roles/permissions`, только чтение — UI не создаёт новые коды, спек `roles`), `useRolePermissionsMatrix` (чтение матрицы + `togglePermission`/`save` → `PATCH /roles/:id/permissions`), `useEmployeeRoleAssignment` (список сотрудников через уже существующий `GET /directory/employees` + мутации назначения/снятия роли). Verify: тесты видны раннеру.
- [x] 19.2 Прогнать тесты из 19.1, зафиксировать red.
- [x] 19.3 Реализовать `frontend/src/features/RoleManagement/model/api.ts` и хуки, публичный `index.ts`.

  Отступление от буквальной формулировки (см. финальный отчёт раздела 19, не решалось
  самостоятельно): `index.ts` реэкспортирует хуки/модель, а не `RoleManagementPanel` — такого
  компонента нет ни в architecture.md на уровне реализации (там только `RoleList`/
  `RolePermissionMatrix`/`EmployeeRoleAssignment`), ни в tasks.md раздела 20, ни в ui-design.md;
  использован задокументированный в проекте прецедент "у фичи нет единого корня"
  (`features/SalesPlan`, `features/AccountingPeriod`, `features/TargetDirectory`,
  `features/SalaryReportData`) — `index.ts` реэкспортирует модель сейчас и получит реэкспорт UI из
  раздела 20, когда тот появится.
- [x] 19.4 Прогнать тесты из 19.1, зафиксировать green, регрессий нет.

## 20. Frontend: `pages/RolesManagement` — UI по ui-design.md

- [x] 20.1 Реализовать `features/RoleManagement/ui/RoleList` (карточки ролей с CRUD, бейдж «Системная» для `Administrator` без удаления) по фрейму `s5nMLx` (узел «Roles Bar», `design/sallary-first-iteration.pen`, читать через `mcp__pencil__execute`/`Get`). Чисто визуальная вёрстка карточек, логика CRUD подключается к хукам раздела 19 без отдельных тестов вёрстки (обоснование: ветвление — только `roles.length`/`role.system`, уже покрыто тестами `useRoles` из 19.1).

  Отступление от макета (см. финальный отчёт раздела 20, не решалось самостоятельно): карточка
  роли на `s5nMLx` показывает счётчик «N сотрудников» под именем роли — ни `RoleResponse`
  (`GET /roles`), ни какой-либо другой эндпоинт `roles` не возвращает число сотрудников с ролью
  (только `permissionCodes`). Счётчик не отображается, а не заменяется выдуманным значением (тот
  же пробел данных, что и у 20.7 ниже).
- [x] 20.2 Реализовать `features/RoleManagement/ui/RolePermissionMatrix` (роли-колонки × права-строки с группировкой, чекбоксы) по фрейму `s5nMLx` (узел «Permission Matrix») — сверить со скриншотом, проверить отсутствие overflow при большом числе ролей/прав (`ctx.problems` — по аналогии с проверкой в Pencil).

  На макете нет видимой кнопки сохранения (сами данные матрицы — иллюстративный placeholder,
  ui-design.md «Отклонения от architecture.md») — добавлена кнопка «Сохранить» под каждой
  колонкой роли, вызывающая `save(roleId)` из `useRolePermissionsMatrix` (необходимый
  интерактивный элемент для применения черновика чекбоксов, а не отступление от контента макета).
  Overflow — `overflow-x-auto` на обёртке таблицы (эквивалент `ctx.problems`-проверки для React,
  а не самого .pen файла).
- [x] 20.3 Написать тест: пустое состояние (`uRNsj`) рендерится вместо списка ролей и матрицы, когда `useRoles().roles` пуст. Verify: тест виден раннеру.
- [x] 20.4 Прогнать тест из 20.3, зафиксировать red, затем реализовать переключение на пустое состояние по фрейму `uRNsj` и зафиксировать green.
- [x] 20.5 Написать тест: модалка создания роли (`vKQ8C`) вызывает `useRoles().createRole(name)` при сохранении и закрывается. Verify: тест виден раннеру.
- [x] 20.6 Прогнать тест из 20.5, зафиксировать red, реализовать модалку по фрейму `vKQ8C`, зафиксировать green.

  Тест проверяет контракт самой модалки (`onCreate`/`onOpenChange`, `CreateRoleModal.spec.tsx`) —
  конечная проводка до `useRoles().createRole(name)` происходит на уровне
  `mediator/RolesManagementPage` (20.8), который в этом разделе НЕ реализован (см. блокер ниже).

Блокер решён пользователем: раздел 22 добавляет `GET /roles/assignments`. 20.7-20.9 продолжаются
ПОСЛЕ раздела 22 (нужны его данные), не раньше.

- [x] 20.7 Реализовать `features/RoleManagement/ui/EmployeeRoleAssignment` (таблица сотрудников с бейджами ролей через `useEmployeeRoleAssignment` — теперь читает `GET /roles/assignments` из раздела 22 — и состоянием «Роль не назначена»: иконка `user-plus` вместо `pencil`) по фрейму `F6d3a` (`design/sallary-first-iteration.pen`, читать через `mcp__pencil__execute`/`Get`).

  Результат: `useEmployeeRoleAssignment` расширен (`employees` теперь несёт `roleIds`
  из `GET /v1/roles/assignments` и `departmentName` из `GET /v1/directory/departments`; хук также
  отдаёт `roles` целиком) — тесты обновлены (`useEmployeeRoleAssignment.spec.tsx`, 4/4 green,
  TDD red зафиксирован: `employees`/`roles` были `undefined`/не содержали `roleIds` до
  реализации). Новый компонент `ui/EmployeeRoleAssignment` (+ `EmployeeRoleAssignment.spec.tsx`,
  4/4 green) — таблица «Сотрудник / Отдел / Роли / Действия», бейдж на роль, иконка
  `pencil`/`user-plus` открывает поповер с чекбоксами ролей (`onAssign`/`onRevoke` — прямые
  мутации, без черновика/кнопки «Сохранить», в отличие от `RolePermissionMatrix` — макет не
  специфицирует это взаимодействие за пределами самой иконки).

  Отступления от макета (документированы в JSDoc компонента, не решались самостоятельно за
  пределами раздела, тот же приём, что и у счётчика «N сотрудников» на карточке роли из 20.1):
  (1) подпись-должность под именем сотрудника («Генеральный директор» и т.п. на `F6d3a`) не
  отображается — ни `EmployeeResponse`, ни любой другой доступный этой фиче эндпоинт не
  возвращает должность; (2) Filter Bar макета (чип «Отдел: Все» + поиск «Поиск сотрудника»,
  `DyYbl`) не реализован — не входит в приёмку этой задачи (только таблица с ролями/состоянием
  «Роль не назначена»), а взаимодействие чипа в макете не специфицировано за пределами статичного
  дефолтного состояния.
- [x] 20.8 Реализовать `pages/RolesManagement/mediator/RolesManagementPage` — оркестрация хуков `useRoles`/`useRolePermissionsMatrix`/`useEmployeeRoleAssignment`, переключение вкладок «Роли и права»/«Сотрудники» (без условного рендера внутри самого медиатора). Подключить роут `/admin/roles` с защитой `roles:manage` (механизм `handle.requiredPermission` уже готов в `app/route-guard`, раздел 15).

  Результат: `mediator/RolesManagementPage.tsx` — вызывает три хука фичи, хранит только
  `activeTab` (`useState`, не рендер-ветвление); `useRoles()` и `useEmployeeRoleAssignment()`
  оба читают `GET /roles` (`ROLES_QUERY_KEY`) — TanStack Query дедуплицирует запрос, `roles.roles`
  передан в обе вкладки одним пропом. Само переключение "какой JSX показать" (`activeTab ===
  'roles' ? ... : ...`) и `isEmpty`-ветвление `RolesAndPermissionsTab` вынесены в новый
  `ui/RolesManagementBody.tsx` (+ `RolesManagementBody.spec.tsx`, 3/3 green, TDD red
  зафиксирован: файл не существовал) — медиатор остаётся чистой склейкой без условного рендера.
  `isEmpty` считается в медиаторе как `!roles.isLoading && roles.roles.length === 0` — без гейта
  на `isLoading` пустое состояние мигнуло бы на экране до первого ответа `GET /roles`. Роут
  `/admin/roles` зарегистрирован в `app/router.tsx` внутри существующего `<RouteGuard><Layout
  /></RouteGuard>` дерева с `handle: { requiredPermission: 'roles:manage' }` — механизм раздела 15
  переиспользован без изменений. `npx tsc -b` и `npm run build` — без ошибок.

  Отступление (не решалось самостоятельно за пределами раздела): пункт меню на страницу
  `/admin/roles` в `app/navigation.tsx` НЕ добавлен — ни tasks.md (раздел 20.8, только "Подключить
  роут"), ни architecture.md/ui-design.md не описывают размещение пункта в навигации; страница
  пока доступна только по прямому URL.
- [x] 20.9 Финальная сверка: скриншот полного экрана `s5nMLx` (вкладка «Роли и права») и `F6d3a` (вкладка «Сотрудники») из Pencil сопоставлен с рендером реализованной страницы — layout, тексты и состояния совпадают.

  Результат: `npm run start` (vite dev) + Playwright (`browser_run_code_unsafe`, `page.route` для
  моков `GET /v1/auth/me|roles|roles/permissions|roles/assignments|directory/employees|
  directory/departments`) — `/admin/roles` отрендерен полностью на реальных данных (не только
  юнит-тестах компонентов) в вьюпорте 1440×1024, сопоставлен с `TakeScreenshot(['s5nMLx'])` и
  `TakeScreenshot(['F6d3a'])` из Pencil. Обе вкладки совпадают по структуре: заголовок+подпись,
  переключатель вкладок, карточки ролей + «Добавить роль», матрица прав с группировкой строк и
  чекбоксами по колонкам-ролям (вкладка «Роли и права»); таблица «Сотрудник/Отдел/Роли/Действия»
  с аватарами-инициалами, бейджами ролей, состоянием «Роль не назначена» + иконкой `user-plus`
  для сотрудника без роли и `pencil` для остальных (вкладка «Сотрудники»). Дополнительно проверено
  интерактивно: клик по иконке действия открывает поповер с чекбоксами ролей; клик по чекбоксу
  вызывает мутацию без ошибок в консоли; сотрудник без `roles:manage` в `permissions` получает
  `pages/AccessDenied` вместо страницы (`RouteGuard`, раздел 15) — сквозная проверка
  guard-механизма на реальном роуте `/admin/roles`, не только юнит-тестом `RouteGuard.spec.tsx`.
  Единственное расхождение с макетом — верхний `Topnav`: страница использует уже существующий
  `app/Header` компонента (переиспользуется всеми страницами `<Layout>`, не специфичен для этого
  раздела), а не точную копию топнава из .pen-файла — вне области этой задачи.

## 21. Итоговая интеграционная проверка

- [x] 21.1 Прогнать полный backend test suite (`npm run test`) и e2e-тесты контроллеров — все зелёные, регрессий в существующих модулях (`employee-identity`, `directory` и др.) нет. Результат: 225 test suites / 1277 tests — все зелёные (jest `testRegex` уже включает `*.e2e.spec.ts`, отдельного прогона не требуется); дополнительно `npm run build` backend проходит без ошибок типов; точечный прогон `--testPathPatterns="modules/(employee-identity|directory|auth|session|roles)/"` — 39 suites / 192 tests, все зелёные, регрессий нет.
- [x] 21.2 Прогнать полный frontend test suite (`npm run test`) — все зелёные. Результат: 71 test files / 395 tests — все зелёные; дополнительно `npm run build` frontend (`tsc -b && vite build`) проходит без ошибок типов.
- [ ] 21.3 Ручной сквозной прогон (или e2e-сценарий) через оба сценария логина: embedded (`BX24.init()` → `AUTH_ID` → сессия) и standalone (`pages/Login` → OAuth-редирект → callback → сессия) — в обоих случаях `GET /auth/me` возвращает корректные `permissions`, `/admin/roles` доступен только с `roles:manage`, изменение прав роли отражается в активной сессии без релогина (спек `roles`), logout инвалидирует сессию в Redis.
  - НЕ ВЫПОЛНЕНО в рамках этой сессии. Ограничение среды: у агента нет доступа к реальному Bitrix24-порталу (нужен для `BX24.init()`/embedded-контекста и для OAuth-редиректа standalone-сценария), нет браузера для интерактивного прохода UI, и нет запущенного Redis/Postgres со staging-данными сотрудника. Автотесты (unit/e2e с моками Bitrix24 и Redis) покрывают эти сценарии на уровне контроллеров и сервисов, но не заменяют сквозную проверку через реальный портал.
  - Что нужно пользователю для финальной верификации вручную: (1) staging-инсталляция Bitrix24-портала с установленным embedded-приложением iReports (или тестовый портал с доступом к маркетплейсу разработчика) для сценария `BX24.init()` → `AUTH_ID`; (2) зарегистрированный тестовый OAuth-клиент Bitrix24 (client_id/secret, redirect_uri на dev/staging-домен iReports) для standalone-сценария `pages/Login` → редирект → callback; (3) поднятые Redis и Postgres (docker-compose) с применёнными миграциями и засеянным каталогом прав/ролью Administrator; (4) сотрудник в `BitrixEmployee` с правами, чтобы проверить как happy path (`GET /auth/me` → `permissions`, доступ к `/admin/roles`), так и live-обновление прав в активной сессии без релогина, и logout с проверкой инвалидации ключа сессии в Redis.

## 22. Backend: `GET /roles/assignments` — данные о назначениях роль↔сотрудник (добавлено по итогам реализации раздела 20) (TDD)

- [x] 22.1 Написать тесты: `RolesQueryHandlers.getRoleAssignments()` возвращает `{employeeId, roleIds}[]` по всем сотрудникам, у которых есть хотя бы одна роль (через существующую таблицу `EmployeeRole`, `backend/prisma/schema/auth.prisma`); e2e-тест контроллера `GET /v1/roles/assignments` под `roles:manage` (401/403/200 по образцу раздела 12). Verify: тесты видны раннеру.
- [x] 22.2 Прогнать тесты из 22.1, зафиксировать red. Результат: `handlers.getRoleAssignments is not a function` — 1 упавший тест в `roles-query-handlers.spec.ts` (остальные 3 в файле проходили, метод ещё не существовал).
- [x] 22.3 Реализовать `RolesQueryHandlers.getRoleAssignments`, эндпоинт `GET /v1/roles/assignments` (`backend/src/modules/roles/interface/http-controllers/`), Zod-схему ответа в `contracts/commands/roles.ts`; обновить `/ENDPOINTS.md` и `@ApiOperation`.
- [x] 22.4 Прогнать тесты из 22.1, зафиксировать green, регрессий нет (`npm run test` backend). Обновить `backend/src/modules/roles/permissions-catalog.contract.spec.ts`-проверку при необходимости (раздел 14) — новый контроллер использует уже существующий код `roles:manage`, реестр менять не должно потребоваться.
  Результат: `roles-query-handlers.spec.ts` — 4/4 green; `roles.e2e.spec.ts` — 15/15 green (3 новых:
  401/403/200 на `GET /v1/roles/assignments`); `permissions-catalog.contract.spec.ts` — 2/2 green без
  изменений (регистр `roles:manage` не менялся, новый контроллер переиспользует существующий код).
  Полный backend suite: 225 test suites / 1281 tests — все зелёные (было 1277, +4 новых теста).
  `npm run build` backend — без ошибок типов. Реализация: `RoleRepositoryPort.findAllAssignments()` +
  Prisma-реализация (группировка `EmployeeRole` по `bitrixEmployeeId` в памяти — Prisma `groupBy` не
  агрегирует список `roleId`), `RolesQueryHandlers.getRoleAssignments()`, маппер
  `toRoleAssignmentResponse` (`bitrixEmployeeId` → `employeeId` в контракте, как и в остальных
  контрактах на сотрудника), `ListRoleAssignmentsHttpController` (`GET /v1/roles/assignments`, тот же
  guard-стек `SessionAuthGuard`+`PermissionsGuard`+`roles:manage`, что и у остальных эндпоинтов
  модуля), `RoleAssignment`/`ListRoleAssignmentsResponse` в `contracts/commands/roles.ts`.

## 23. Frontend: OAuth `state` (защита от login-CSRF) + приём OAuth-редиректа (design.md Decision 13) (TDD)

- [x] 23.1 Написать тесты: `useBitrixLogin().login()` генерирует случайный `state`, сохраняет его в `sessionStorage` перед редиректом на `{portal}/oauth/authorize/` и включает его в query-параметры редиректа; `pages/OAuthCallback` (`useOAuthCallback`) при совпадении `state` из URL с сохранённым — отправляет `code` на backend и удаляет сохранённое значение; при несовпадении/отсутствии — не отправляет `code` и показывает ошибку, ничего не удаляя лишний раз. Verify: тесты видны раннеру.
- [x] 23.2 Прогнать тесты из 23.1, зафиксировать red. Результат: `useBitrixLogin.spec.ts` падает на `Failed to resolve import "./oauthState.ts"`; `useOAuthCallback.spec.tsx`/`OAuthCallbackPage.spec.tsx` падают на отсутствующих `./useOAuthCallback.ts`/`./OAuthCallbackPage.tsx` — все три файла ещё не существовали.
- [x] 23.3 Реализовать генерацию/сохранение `state` в `features/Auth/model/useBitrixLogin.ts`; реализовать `pages/OAuthCallback/{ui/OAuthCallbackPage.tsx, model/useOAuthCallback.ts}` (без вёрстки по Pencil-фрейму — короткое сообщение "Выполняется вход…"/"Не удалось войти" текстом, страница не входит в ui-design.md), подключить `api.oauthExchange` в `features/Auth/model/api.ts` (`POST /v1/auth/oauth/callback`, уже реализован в разделе 12 backend), зарегистрировать роут (например `/auth/callback`) в `frontend/src/app/router.tsx`.
- [x] 23.4 Прогнать тесты из 23.1, зафиксировать green, регрессий нет (`npm run test` frontend).
  Результат: `useBitrixLogin.spec.ts` — 4/4 green (2 новых теста на `state`); `useOAuthCallback.spec.tsx`
  — 4/4 green (новый файл); `OAuthCallbackPage.spec.tsx` — 2/2 green (новый файл). Полный frontend
  suite: 73 test files / 403 tests — все зелёные (было 71/395, +2 файла/+8 тестов). `npx tsc -b` и
  `npm run build` — без ошибок, `npx eslint .` — без ошибок (только 2 pre-existing warning о legacy
  boundaries-синтаксисе, не связанные с этой секцией). Реализация: `features/Auth/model/oauthState.ts`
  (`createAndStoreOAuthState`/`consumeStoredOAuthState` — одноразовая сверка `state` одним
  read+remove действием, spec: auth#oauth-login-csrf-state-protection), `useBitrixLogin.ts` теперь
  включает `state` в query-параметр редиректа; `features/Auth/model/api.ts` — `api.oauthExchange`
  (`POST /v1/auth/oauth/callback`); `features/Auth/index.ts` — новые публичные экспорты
  (`AUTH_ME_QUERY_KEY`, `authApi`, `OAUTH_STATE_STORAGE_KEY`, `consumeStoredOAuthState`), нужные
  `pages/OAuthCallback` (FSD-граница: импорт фичи только через её `index.ts`);
  `pages/OAuthCallback/{model/useOAuthCallback.ts, ui/OAuthCallbackPage.tsx}` — mutation-хук +
  текстовая страница без Pencil-вёрстки; роут `/auth/callback` в `app/router.tsx` вне `RouteGuard`
  (в момент обмена `code` валидной сессии ещё не существует, `RouteGuard` увёл бы на `pages/Login`
  раньше).

## 24. Финализация: включить глобальные guard'ы и повторная проверка (Decision 5, Migration Plan)

- [x] 24.1 Раскомментировать регистрацию `SessionAuthGuard`→`PermissionsGuard` (и, где применимо, `CsrfGuard`) как `APP_GUARD` в `backend/src/app.module.ts` — раздел 20 (маршрут `/admin/roles` и вся цепочка frontend-аутентификации) теперь реализован, откладывать больше не нужно (design.md Migration Plan, шаг 6-7).

  Результат: раскомментированы три провайдера (`SessionAuthGuard`, `CsrfGuard`, `PermissionsGuard`
  как `APP_GUARD`, в этом порядке — `SessionAuthGuard` заполняет `request.user` первым) и их импорты
  в `backend/src/app.module.ts`. Комментарий-обоснование задержки заменён на комментарий с текущим
  состоянием и ОДНИМ известным, не исправленным в рамках этой задачи разрывом (см. блокер ниже).

- [x] 24.2 Прогнать полный backend test suite — убедиться, что глобальное включение guard'ов не сломало существующие роуты вне `auth`/`session`/`roles` (они не помечены `@RequirePermissions`, но теперь ВСЕ требуют валидной сессии, если не помечены `@Public()` — по спеку `roles` это ожидаемое поведение, но стоит явно проверить, что ни один нужный публичный/health-check роут не остался без `@Public()`).

  ВАЖНАЯ НАХОДКА (проверено, не просто предположение): `npm run test` был зелёным ДО и остаётся
  зелёным ПОСЛЕ включения `APP_GUARD` (225→226 test suites, +1) — но это НЕ подтверждает, что
  глобальная регистрация вообще работает. Ни один существующий `*.e2e.spec.ts` (`directory`,
  `catalog`, `sales-plan`, `employee-identity` и т.д.) не бутстрапит настоящий `AppModule` целиком —
  каждый собирает свой локальный `@Module` только со своими контроллерами (изоляция от транзитивных
  зависимостей `AppModule`: `BitrixModule`/Prisma/Redis), а `roles`/`auth`-e2e-тесты применяют
  `SessionAuthGuard`/`PermissionsGuard` точечно через `@UseGuards`, не через `APP_GUARD`. Значит без
  отдельной проверки регистрация в `app.module.ts` могла быть ошибочной (например, забытый импорт),
  и весь backend test suite остался бы зелёным. Добавлен `backend/src/app.module.guards.e2e.spec.ts`
  — минимальный модуль с двумя тестовыми контроллерами и РОВНО той же формой регистрации `{ provide:
  APP_GUARD, useClass: ... }`, что и в `app.module.ts`: подтверждает 401 без сессии на роуте без
  `@Public()` (раньше был открыт всем), 200 с валидной сессией и без `@RequirePermissions` (roles#
  route-without-permissions-open-to-any-authenticated), 200 без сессии на роуте с `@Public()`.
  Результат: 226 test suites / 1284 tests — все зелёные (было 225/1281, +3 новых теста).
  `npm run build` backend — без ошибок типов, `npx eslint` — без ошибок на изменённых файлах.

  БЛОКЕР (найден, НЕ исправлен самостоятельно — вне мандата этой задачи, см. финальный отчёт):
  `POST /bitrix/install` (`backend/src/integrations/bitrix/bitrix.controller.ts`) — вызывается
  САМИМ Bitrix24 при установке/переустановке приложения (см. JSDoc метода), не может нести валидную
  сессию iReports и НЕ размечен `@Public()`. С этим глобальным включением guard'ов этот роут вернёт
  401 вместо успешной установки/переустановки приложения в маркетплейсе Bitrix24. НЕ исправлено:
  правки `backend/src/integrations/bitrix/**` явно вне мандата (инструкция «не трогай
  backend/src/integrations/bitrix/**»); минимальное исправление — один `@Public()` на методе
  `install`, тем же приёмом, что уже применён на `bitrix-oauth-callback`/`bitrix-embedded-login`
  контроллерах auth-модуля.

  Менее уверенная (не проверялась глубже, тоже не исправлена) находка: `GET /roapp/service-
  categories` (`backend/src/domains/service/integrations/roapp/roapp.controller.ts`) и `POST
  /custom-api-roapp/create-service`/`GET /custom-api-roapp/service-bonus/:id`
  (`.../custom-api-roapp/custom-api-roapp.controller.ts`) не вызываются из frontend (проверено
  `grep`) и не задокументированы как вызываемые извне (RemOnline) — не выяснено, служебные ли это
  эндпоинты (тогда защита сессией — ожидаемое ужесточение) или всё же внешний вызов от RemOnline
  (тогда тоже нужен `@Public()`). Эти файлы НЕ под явным запретом «не трогай bitrix/**», но решение
  оставлено пользователю — правка вслепую рискует либо оставить дыру, либо сломать реальную внешнюю
  интеграцию.

- [x] 24.3 Прогнать полный frontend test suite и `npm run build` (backend и frontend) — регрессий нет.

  Результат: backend — 226 test suites / 1284 tests зелёные, `npm run build` без ошибок. Frontend —
  75 test files / 411 tests зелёные (не изменились этой секцией), `npx tsc -b` без ошибок.

- [x] 24.4 Обновить пункт 21.3: остаётся открытым для ручной проверки пользователем (см. обоснование в разделе 21) — не пытаться закрыть автоматически.

  Результат: 21.3 не тронут (уже помечен `[ ]` с подробным обоснованием от раздела 21) — глобальное
  включение guard'ов в этой секции не меняет того, что сквозной ручной прогон через реальный
  Bitrix24-портал по-прежнему требует staging-инфраструктуры, недоступной агенту.
