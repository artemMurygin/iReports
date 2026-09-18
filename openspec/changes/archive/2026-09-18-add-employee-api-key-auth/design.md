## Context

Текущая аутентификация — глобальные `APP_GUARD`: `SessionAuthGuard` → `CsrfGuard` →
`PermissionsGuard` (`backend/src/app.module.ts:108-110`). Все три — обязательные и выполняются по
цепочке (AND, не OR): чтобы добавить второй способ аутентификации, нельзя просто зарегистрировать
рядом ещё один `APP_GUARD` — он не "заменит" провал `SessionAuthGuard`, а добавится к нему. Поэтому
проверка API-ключа должна быть веткой внутри существующего `SessionAuthGuard`
(`backend/src/modules/session/interface/session-auth.guard.ts`), а не отдельным guard'ом.

`CsrfGuard` уже пропускает запросы без cookie-сессии (`csrf.guard.ts:63-65`) — запросы по
API-ключу физически не несут `SESSION_COOKIE_NAME` cookie, поэтому `CsrfGuard` их не тронет без
каких-либо изменений в нём.

Permissions сотрудника при обычном логине вычисляются один раз (`PermissionsResolverPort`,
`resolvePermissions(bitrixEmployeeId)`, `src/modules/roles/application/ports/
permissions-resolver.port.ts`) и кладутся в Redis-сессию; при изменении роли уже созданные сессии
обновляются push'ем (`roles-command-handlers.service.ts:107-134`). У API-ключа нет долгоживущей
сессии, которую можно было бы push'ить — поэтому уместнее резолвить permissions заново на каждый
запрос через тот же `PermissionsResolverPort`, а не кэшировать их где-либо.

Создание записи сотрудника происходит только через `upsert` в
`backend/src/sync/bitrix/bitrix-sync.service.ts:124` (`upsertEmployeeRecord`), вызываемый как
массовой синхронизацией (`BitrixCatalogsSyncCron`, `upload-initial-bitrix-data.handler.ts`), так и
self-heal адаптером при логине (`bitrix-employee-upsert.adapter.ts`). См. `proposal.md` за
мотивацией; полное поведение — в `specs/auth/api-key/spec.md`.

## Goals / Non-Goals

**Goals:**
- Минимальное изменение существующей guard-цепочки — не вводить отдельный `APP_GUARD`.
- Не кэшировать permissions API-ключа нигде отдельно — читать RBAC "вживую" на каждый запрос,
  переиспользуя существующий `PermissionsResolverPort`.
- Не хранить ключ в открытом виде в базе.

**Non-Goals:**
- Множественные/именованные ключи, UI управления, просмотр текущего ключа — явно исключены
  proposal'ом.
- Rate limiting/анти-brute-force для попыток аутентификации по ключу — за пределами этого
  изменения (энтропия ключа делает перебор непрактичным без дополнительной защиты; при появлении
  реальной угрозы — отдельная задача).
- Изменение `CsrfGuard` — не требуется (см. Context).

## Decisions

### 1. Хранение — хэш, не значение ключа
Поле называется `apiKeyHash` (не `apiKey`) и хранит `SHA-256`-хэш ключа (hex), не сам ключ.
Значение ключа отдаётся вызывающему только один раз — в ответе на регенерацию — и не
восстановимо из базы.

**Почему SHA-256, а не bcrypt/argon2**: ключ должен матчиться на **каждый** HTTP-запрос точным
поиском по индексу (`WHERE api_key_hash = ?`), а не перебором с медленным KDF (bcrypt/argon2
специально медленные и не поддерживают эту схему — как и пароль, ключ нельзя было бы найти без
полного перебора всех строк). SHA-256 детерминирован и быстр, а бороться с оффлайн-перебором не
требуется: сам ключ — 32 случайных байта энтропии, находится не по словарю, а полным перебором,
что неосуществимо. Тот же trade-off, что у GitHub/Stripe personal access token.

### 2. Формат ключа
`irk_<43 символа base64url>` — `randomBytes(32).toString('base64url')` с префиксом `irk_`
(iReports Key), по образцу `SessionId.generate()`
(`session/domain/value-objects/session-id.value-object.ts:16-19`), но с префиксом. Префикс — для
узнаваемости в логах/секрет-сканерах (общепринятая практика: `ghp_`, `sk-` и т.п.), не влияет на
энтропию (32 байта = 256 бит, избыточно для брутфорса).
Новый value object `ApiKey` (`session/domain/value-objects/api-key.value-object.ts`) — `generate()`
возвращает пару `{ value, hash }`, `hash(rawValue)` — чистая функция для вычисления хэша входящего
запроса.

### 3. Логика — ветка внутри `SessionAuthGuard`, без нового модуля
Вся реализация — внутри существующего модуля `session` (не новый `src/modules/api-key/`):
- `session/domain/value-objects/api-key.value-object.ts` — генерация/хэширование (Decision 1-2).
- `session/infrastructure/api-key.repository.ts` — два метода поверх Prisma:
  `findActiveEmployeeByApiKeyHash(hash)` (для аутентификации, `isActive: true`) и
  `regenerateApiKey(employeeId)` (для эндпоинта регенерации).
- `session-auth.guard.ts`: **до** текущей логики `extractSessionId` — если запрос несёт заголовок
  `X-Api-Key`, аутентификация идёт этой веткой (хэшируем значение, ищем сотрудника, резолвим
  permissions через `PermissionsResolverPort`, заполняем `request.user`, `return true`; не найден
  или сотрудник неактивен — `UnauthorizedException`) и **не** идёт в существующую ветку
  сессии. Отсутствие заголовка — поведение не меняется (текущая сессионная логика как есть).
  `@Public()`/dev-bypass проверяются как раньше, до этой ветки.
- Новый контроллер `session/interface/http-controllers/regenerate-api-key.http-controller.ts` —
  `POST /v1/auth/api-key/regenerate`, читает `request.user.employeeId` (уже заполнен
  `SessionAuthGuard` из сессии — см. spec-требование "Регенерация недоступна без сессии"), вызывает
  `regenerateApiKey`, возвращает новое значение.

**Альтернатива (отклонена)**: отдельный модуль `src/modules/api-key/` со своим репозиторием,
который `session`-модуль вызывал бы через DI-порт. Учитывая объём (одно поле, два метода) отдельный
модуль — преждевременное усложнение; вся логика и так про "как аутентифицировать HTTP-запрос", что
уже мандат модуля `session`. Прямой доступ к таблице `bitrix_employees` из `session`-модуля — не
нарушение правила "Межмодульные зависимости внутри backend" (root CLAUDE.md): `session` не вызывает
application-сервис чужого модуля, а читает/пишет одно поле через свой собственный репозиторий на
той же физической таблице, которой и так владеет `sync/bitrix` для остальных полей — тот же
паттерн, что уже применяется для общих таблиц `service`/`shop`.

### 4. Точка генерации и backfill для существующих сотрудников
`upsertEmployeeRecord` (`bitrix-sync.service.ts:124`) генерирует `apiKeyHash` только в ветке
`create` Prisma-upsert'а (новая запись) — ветка `update` его не трогает, что даёт требуемую
"генерацию один раз при создании, неизменность при последующих синхронизациях" (спека
`auth/api-key`).
Для уже существующих в базе сотрудников (на момент выката этого изменения) миграция сама по себе
их не создаёт заново (upsert видит существующую строку → идёт в `update`, без ключа) — нужен
одноразовый backfill-скрипт (по образцу `src/scripts/*`), генерирующий `apiKeyHash` для всех строк
`bitrix_employees`, где оно ещё `NULL`, тем же способом (`ApiKey.generate().hash`). Колонка
`apiKeyHash` — `String? @unique` (nullable) до и после backfill'а на случай будущих граничных
случаев; guard просто не аутентифицирует запрос, если `apiKeyHash IS NULL`.

## Risks / Trade-offs

- **[Риск] Утечка ключа из логов/трейсов** (заголовок легко случайно залогировать) → префикс
  `irk_` упрощает пост-фактум секрет-сканирование; ключ не логируется явно нигде в новом коде
  (только хэш при поиске).
- **[Риск] Backfill-скрипт не запущен на проде до раската** → до запуска backfill у "старых"
  сотрудников `apiKeyHash IS NULL`, API-ключ для них не работает (не ошибка, а просто отсутствие
  функциональности) — session-путь входа не затронут. Пункт backfill'а — обязательный шаг
  Migration Plan, не опциональный.
- **[Trade-off] Permissions резолвятся заново на каждый запрос с API-ключом** (Decision, Context) →
  на один Redis/DB-round-trip дороже, чем чтение из уже провалидированной сессии, но исключает
  риск устаревших permissions без отдельного push-механизма для API-ключей.

## Migration Plan

1. Prisma-миграция: добавить `apiKeyHash String? @unique @map("api_key_hash")` в модель
   `BitrixEmployee` (`bitrix.prisma`) — аддитивная, без даунтайма.
2. Реализовать `ApiKey` value object, `api-key.repository.ts`, ветку в `SessionAuthGuard`,
   контроллер регенерации (см. Decisions 1-3).
3. Обновить `upsertEmployeeRecord` — генерация `apiKeyHash` в ветке `create` (Decision 4).
4. Одноразовый backfill-скрипт для существующих сотрудников, прогнать один раз после деплоя
   миграции и до/вместе с деплоем остального кода (порядок не критичен — до реализации guard'а
   `apiKeyHash IS NULL` просто не используется).
5. Rollback — миграция чисто аддитивная (новая nullable-колонка), откат кода не требует отдельной
   down-миграции данных; при откате колонка может остаться неиспользуемой без вреда.
