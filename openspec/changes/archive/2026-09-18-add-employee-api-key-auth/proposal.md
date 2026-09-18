## Why

Сейчас единственный способ аутентификации в iReports — сессия, полученная через вход в Bitrix24
(embedded/iframe или OAuth), см. `openspec/specs/auth/spec.md` и `openspec/specs/session/spec.md`.
Это делает невозможным прямой программный доступ к API от имени конкретного сотрудника (личные
скрипты, внешние интеграции, cron-задачи, curl/Postman) без эмуляции полноценного входа через
Bitrix24. Нужен второй, независимый от Bitrix-сессии способ аутентификации — персональный API-ключ
сотрудника, — которым можно обращаться к backend напрямую.

## What Changes

- Новое поле `apiKey` (уникальное) на существующей таблице `BitrixEmployee` — без отдельной
  сущности. Один ключ на сотрудника, без названия/списка/множественных ключей.
- Ключ генерируется автоматически в момент **первого** появления записи сотрудника в базе — то
  есть при первом upsert в `bitrix-sync.service.ts:upsertEmployeeRecord` (массовая синхронизация
  `BitrixCatalogsSyncCron`, первоначальная загрузка `upload-initial-bitrix-data.handler.ts`, либо
  self-heal при логине `BitrixEmployeeUpsertAdapter`) — не перегенерируется при последующих
  синхронизациях уже существующего сотрудника.
- Новый independent guard проверки API-ключа, работающий в общей guard-цепочке
  (`backend/src/app.module.ts`, сейчас `SessionAuthGuard` → `CsrfGuard` → `PermissionsGuard`)
  как альтернативный источник аутентификации: запрос с валидным API-ключом получает
  `request.user = { employeeId, permissions }` так же, как это делает `SessionAuthGuard` для
  сессии, и дальше проходит через существующий `PermissionsGuard`/RBAC без изменений.
  `CsrfGuard` для API-key-запросов не применяется (не браузерный cookie-контекст).
- API-ключ несёт те же permissions, что и сам сотрудник через существующий RBAC
  (`openspec/specs/roles`) — отдельной системы прав для ключей не вводится.
- Один новый эндпоинт — регенерация ключа текущего сотрудника (аутентифицированного через сессию):
  инвалидирует старый ключ и выдаёт новый, возвращая его значение в ответе (единственный момент,
  когда ключ виден в открытом виде после первичной генерации).
- Уволенный сотрудник (`BitrixEmployee.isActive = false`) — его API-ключ перестаёт проходить
  аутентификацию.
- Frontend не меняется — управление ключом только через backend-эндпоинт.

## Capabilities

### New Capabilities
- `auth/api-key`: автогенерация, хранение и проверка персонального API-ключа сотрудника (поле на
  `BitrixEmployee`), регенерация по эндпоинту, аутентификация HTTP-запросов по ключу как
  альтернатива Bitrix-сессии с сохранением существующего RBAC для авторизации.

### Modified Capabilities
_(нет — существующие `auth` и `session` описывают только Bitrix-сессионный сценарий входа и не
меняются; `roles`/RBAC используется как есть, без изменения требований)_

## Impact

- **Backend**: миграция Prisma — новое поле `apiKey` в `BitrixEmployee`
  (`backend/prisma/schema/bitrix.prisma`); генерация ключа в `upsertEmployeeRecord`
  (`backend/src/sync/bitrix/bitrix-sync.service.ts:124`) при создании новой записи; новый guard
  (по аналогии с `SessionAuthGuard`) и его регистрация в `backend/src/app.module.ts`; один новый
  HTTP-эндпоинт регенерации ключа (например `POST /v1/auth/api-key/regenerate`); RBAC
  (`PermissionsGuard`) переиспользуется без изменений.
- **Frontend**: не затрагивается.
- **Contracts**: одна новая Zod-схема ответа для эндпоинта регенерации в `ireports-contracts`.
- **Безопасность**: ключ передаётся только по HTTPS; способ хранения (plain vs хэш) и формат
  генерации (по аналогии с `randomBytes(32).toString('base64url')` из
  `session-id.value-object.ts:17`) — предмет `design.md`; т.к. просмотра ключа кроме как через
  регенерацию нет, при компрометации сотрудник должен регенерировать ключ сам.
