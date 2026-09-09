## Why

Сейчас в iReports нет ни одного слоя защиты: аутентификация через Bitrix24 не реализована,
серверного сессионного слоя не существует, разграничения прав нет вовсе — любой, кто дошёл до
контроллера, видит весь контент без проверок. Это блокирует открытие продукта за пределы
доверенного узкого круга и работу в трёх нужных контекстах запуска (встроенным во фрейм портала
Bitrix24, как standalone-сайт, как нативное iOS-приложение), для каждого из которых Bitrix24
предлагает разный протокол получения токена, а cookie-сессии в iframe ненадёжны из-за
SameSite/ITP-ограничений браузеров. Нужно закрыть все три слоя (аутентификация, сессии,
авторизация) одним согласованным изменением, а не по частям, потому что они взаимозависимы:
модель сессии определяется способом доставки session_id, который, в свою очередь, зависит от
контекста запуска, а RBAC-guard'ы не имеют смысла без предварительно валидированной сессии.

## What Changes

- Реализовать оба сценария получения токенов Bitrix24: embedded/iframe (`BX24.init()` → передача
  `AUTH_ID`/`member_id` на backend → обязательная валидация реальным REST-запросом, например
  `user.current`, — без нее POST-данным из фрейма доверять нельзя) и полный OAuth 2.0
  authorization code flow (redirect на `{portal}/oauth/authorize/`, обмен `code` на
  `access_token`/`refresh_token` строго на backend через `oauth.bitrix24.tech/oauth/token/`,
  `client_secret` никогда не покидает backend) для standalone-сайта и iOS (тот же OAuth через
  `ASWebAuthenticationSession` с redirect_uri в виде universal link/кастомной URL-схемы).
- Свести оба сценария к одному и тому же **существующему** сотруднику Bitrix24 (`BitrixEmployee`,
  уже используется справочником сотрудников — его `id` и есть числовой ID пользователя Bitrix24),
  а не заводить для этого отдельную новую сущность `User`, дублирующую уже существующий справочник:
  токены (`access_token`, `refresh_token`, `expires_at`) хранятся в новой таблице, привязанной к
  `BitrixEmployee.id`, с автообновлением `access_token` через `refresh_token` до истечения срока
  действия — дальнейшая логика (сессии, RBAC) не должна знать, каким путём токены получены.
- Добавить серверные сессии в Redis: `session_id -> {bitrixEmployeeId, permissions}` (без
  отдельного `userId` — идентичность и так уже есть в системе, см. ниже), с двумя способами
  доставки `session_id` клиенту — HttpOnly/Secure/SameSite=None cookie (standalone-сайт, iOS) и
  `Authorization: Bearer <session_id>` (iframe, хранится на фронтенде только в памяти).
  `session_id` — криптографически случайная строка (≥32 байт энтропии), генерируется заново при
  каждом логине (защита от session fixation); TTL — sliding expiration, продлевается при
  активности, значение конфигурируемо; logout удаляет сессию из Redis, а не только cookie на
  клиенте; обратный индекс `employee_sessions:<bitrixEmployeeId> -> set(session_id)` даёт
  возможность принудительно инвалидировать все сессии конкретного сотрудника.
- Ввести RBAC-модель данных `Role – Permission`, связанных со СУЩЕСТВУЮЩИМ `BitrixEmployee` через
  связующие таблицы (роль↔сотрудник, роль↔право; many-to-many в обе стороны) — без отдельной новой
  сущности `User`. `permission` в формате `resource:action` (`reports:view`, `reports:edit`,
  `reports:delete`, `users:manage`, `roles:manage` и т.д.); роли и права создаются и меняются через
  UI/API, без хардкода в коде и без деплоя. Роли/права сотрудника в Bitrix24 (должность, отдел)
  намеренно не становятся ролями iReports — независимые системы прав.
- Подключить глобальные backend-guard'ы через `APP_GUARD`: `SessionAuthGuard` (валидация
  `session_id` из cookie/заголовка в Redis, наполнение `request.user`, продление TTL) и
  `PermissionsGuard` (сверка метаданных `@RequirePermissions('resource:action', ...)` через
  `Reflector` с `request.user.permissions`; роут без указанных permissions при валидной сессии
  доступен любому аутентифицированному пользователю); декоратор `@Public()` — для роутов без
  аутентификации (OAuth-callback, health-check и т.п.).
- Добавить на frontend: определение контекста запуска (iframe портала vs standalone/iOS) на старте
  приложения для выбора сценария логина; `GET /auth/me` и хранение полученных `permissions` в
  клиентском сторе; хук `useHasPermission(permission: string): boolean`; условный рендеринг
  элементов управления и пунктов меню; защиту роутов с явным экраном "нет доступа" при прямом
  переходе по URL без нужного permission. Зафиксировать явно: frontend-проверки — UX-слой, а не
  механизм безопасности, backend обязан перепроверять права на каждый запрос независимо от
  фронтенда.
- Добавить админ-страницу управления ролями (доступна только с `roles:manage`): список ролей с
  созданием/переименованием/удалением, матрица "роль × permission" с чекбоксами, сохранение через
  `PATCH /roles/:id/permissions`, список пользователей с назначением/снятием ролей; при сохранении
  новых permissions для роли — немедленный сброс/обновление закэшированных permissions во всех
  активных сессиях пользователей этой роли (без необходимости релогина).
- CSRF-защита (double-submit или synchronizer token) для cookie-варианта сессии, так как
  `SameSite=None` разрешает cross-site отправку.

## Capabilities

### New Capabilities
- `auth`: получение и поддержание токенов Bitrix24 для пользователя в двух сценариях
  (embedded/iframe с валидацией через REST, OAuth 2.0 authorization code — включая iOS), сведение
  обоих сценариев к одному и тому же существующему `BitrixEmployee` (без новой сущности `User`),
  автообновление `access_token` через `refresh_token`.
- `session`: серверные сессии в Redis — создание/чтение/продление/удаление, sliding
  TTL, ротация `session_id` при логине, доставка через cookie или `Authorization`-заголовок в
  зависимости от контекста запуска, принудительная инвалидация всех сессий сотрудника через
  обратный индекс, CSRF-защита cookie-варианта.
- `roles`: модель данных `Role–Permission`, привязанная к существующему `BitrixEmployee` (без
  новой сущности `User`), backend-guard'ы (`SessionAuthGuard`, `PermissionsGuard`,
  `@RequirePermissions`, `@Public`), frontend-защита (`useHasPermission`, защита роутов/меню,
  экран "нет доступа"), админ-страница управления ролями и немедленное применение изменений
  permissions к активным сессиям.

### Modified Capabilities
(нет — все три капабилити создаются впервые; в `openspec/specs/` пока нет ни одной
пересекающейся по теме капабилити. Существующая интеграция
`backend/src/integrations/bitrix/auth/**` решает другую задачу — авторизацию самого приложения на
портале при установке/вызовах от его имени (`portal-admin.guard.ts`,
`bitrix-auth.service.ts`), а не аутентификацию конечного пользователя iReports; её спек этим
change не создаётся и не меняется, но переиспользование её HTTP-клиента к Bitrix24 REST для нового
слоя — вопрос design.md, а не proposal.md)

## Impact

- **Backend**: новые сквозные модули вне доменов `opt/service/shop` — по аналогии с уже
  существующими `src/modules/employee-identity`, `src/modules/employee-balance`
  (`src/modules/auth`, `src/modules/session`, `src/modules/roles` — точная
  граница между модулями уточняется в design.md); подключение Redis для сессий (уже используется
  для кэша — потребуется отдельный namespace ключей, чтобы не пересекаться с кэш-ключами);
  глобальные `APP_GUARD` (`SessionAuthGuard`, `PermissionsGuard`); новые эндпоинты (OAuth
  callback/exchange, `GET /auth/me`, `POST /auth/logout`, `GET/POST/PATCH/DELETE /roles`,
  `PATCH /roles/:id/permissions`, назначение/снятие ролей сотруднику) — обновление
  `ENDPOINTS.md` и подключение новых модулей в `commonDocument` Swagger-группы
  (`src/config/swagger.config.ts`) обязательны в том же PR, где заводятся модули; новые Prisma-
  модели `Role`/`Permission` и связующие таблицы роль↔сотрудник/роль↔право, а также модель для
  `access_token`/`refresh_token`, привязанная к **существующему** `BitrixEmployee.id` (новая
  сущность `User` не заводится — `BitrixEmployee` уже и есть идентичность пользователя в системе,
  его `id` совпадает с числовым ID пользователя Bitrix24) — через миграции. Так как
  `BitrixSyncService.uploadEmployees()` сегодня не крон, а только ручной скрипт (`npm run
  initial`), логин-флоу `auth` при отсутствии строки `BitrixEmployee` для полученного
  ID самостоятельно её создаёт (апсерт по данным `user.current`) — иначе новый сотрудник не
  сможет войти до ручного перезапуска скрипта; это уточняется в design.md.
- **Frontend**: определение контекста запуска на старте приложения, стор `permissions`, хук
  `useHasPermission`, обёртка для защиты роутов, экран "нет доступа", админ-страница управления
  ролями (`roles:manage`).
- **iOS-приложение**: OAuth через `ASWebAuthenticationSession` с universal link/custom URL scheme —
  вне репозитория iReports, но контракт `redirect_uri`/callback фиксируется на этапе design.md.
- **Существующая интеграция Bitrix24**: `backend/src/integrations/bitrix/**` (авторизация самого
  приложения при установке на портал) остаётся не тронутой этим change. Новые модули СОЗНАТЕЛЬНО
  зависят (только на чтение/апсерт через существующие точки расширения, не копируя код) от уже
  существующих сквозных сущностей: `BitrixEmployee` (`backend/prisma/schema/bitrix.prisma`,
  наполняется `src/sync/bitrix`) как идентичность пользователя и уже существующего порта
  `DIRECTORY_REPOSITORY` (`src/modules/directory`) для списка сотрудников на админ-странице ролей
  — вместо того чтобы заводить параллельный справочник пользователей.
- **Вне scope этого change**: ownership-based проверки доступа (например "редактировать только
  свои записи"), автоматическая синхронизация ролей/прав из Bitrix24 по должности/отделу,
  двухфакторная аутентификация и восстановление пароля, публикация/настройка самого приложения в
  маркетплейсе Bitrix24 (`client_id`/`client_secret`/`redirect_uri` — предполагается настроенным
  вручную до начала реализации).
