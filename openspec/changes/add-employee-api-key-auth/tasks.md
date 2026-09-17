## 1. Данные

- [x] 1.1 Добавить в `backend/prisma/schema/bitrix.prisma` поле `apiKeyHash String? @unique @map("api_key_hash")` на модель `BitrixEmployee` (design.md Decision 1/4) и сгенерировать Prisma-миграцию (`npx prisma migrate dev --config prisma.config.ts --name add-employee-api-key-hash`); проверка — миграция применяется без ошибок, `npx prisma generate` проходит.

## 2. Value object и хэширование ключа

- [x] 2.1 Создать `backend/src/modules/session/domain/value-objects/api-key.value-object.ts` — `ApiKey.generate()` (префикс `irk_` + `randomBytes(32).toString('base64url')`, design.md Decision 2) возвращает `{ value, hash }`; `ApiKey.hash(rawValue)` — чистая функция SHA-256 (design.md Decision 1); проверка — unit-тест `api-key.value-object.spec.ts`: формат сгенерированного значения, детерминированность и стабильность `hash()` для одного и того же входа, разные значения при повторных `generate()`.

## 3. Репозиторий

- [x] 3.1 Создать `backend/src/modules/session/infrastructure/api-key.repository.ts` с методами `findActiveEmployeeByApiKeyHash(hash)` (только `isActive: true`, спека `auth/api-key#dismissed-employee-key-rejected`) и `regenerateApiKey(employeeId): Promise<string>` (сохраняет новый хэш, возвращает сырое значение); проверка — unit/интеграционный тест на реальной тестовой БД: поиск по хэшу находит только активного сотрудника, `regenerateApiKey` инвалидирует прежнее значение (старый хэш больше не матчится).

## 4. Генерация при создании сотрудника

- [x] 4.1 В `backend/src/sync/bitrix/bitrix-sync.service.ts:upsertEmployeeRecord` — сгенерировать `apiKeyHash` через `ApiKey.generate()` в ветке `create` Prisma-upsert'а, не трогать поле в ветке `update` (design.md Decision 4); проверка — существующий/обновлённый unit-тест `bitrix-sync.service.spec.ts`: у новой записи появляется `apiKeyHash`, повторный upsert той же записи не меняет значение.
- [x] 4.2 Одноразовый backfill-скрипт (по образцу `backend/src/scripts/*`) — сгенерировать `apiKeyHash` для всех строк `bitrix_employees`, где оно `NULL` (design.md Decision 4, Migration Plan шаг 4); проверка — запуск скрипта на тестовой БД с существующими записями заполняет все `NULL`, повторный запуск не меняет уже заполненные значения.

## 5. Аутентификация по ключу в guard'е

- [x] 5.1 Расширить `backend/src/modules/session/interface/session-auth.guard.ts` веткой проверки заголовка `X-Api-Key` до текущей логики `extractSessionId` (design.md Decision 3): при наличии заголовка искать сотрудника через `api-key.repository.ts`, при находке резолвить permissions через существующий `PermissionsResolverPort`, заполнять `request.user`, `return true`; отсутствие совпадения — `UnauthorizedException`; при отсутствии заголовка — поведение не меняется; проверка — расширенный `session-auth.guard.spec.ts`: валидный ключ аутентифицирует без сессии, невалидный/чужой ключ отклоняется 401, ключ уволенного сотрудника отклоняется 401, запрос без заголовка и без сессии по-прежнему отклоняется как раньше.
- [x] 5.2 Проверить (тестом или вручную), что `CsrfGuard` пропускает запросы, аутентифицированные по `X-Api-Key` (design.md Context — уже работает через отсутствие cookie-сессии, изменений в `csrf.guard.ts` не требуется); проверка — e2e/интеграционный тест: `POST`-запрос с валидным `X-Api-Key` без CSRF-заголовка и без cookie проходит `CsrfGuard`.

## 6. Эндпоинт регенерации

- [x] 6.1 Добавить Zod-схему ответа регенерации ключа в `ireports-contracts` (design.md, Impact в proposal.md); проверка — контракт собирается, типы экспортируются.
- [x] 6.2 Создать `backend/src/modules/session/interface/http-controllers/regenerate-api-key.http-controller.ts` — `POST /v1/auth/api-key/regenerate`, требует активную сессию (не `@Public()`), берёт `request.user.employeeId`, вызывает `regenerateApiKey`, возвращает новое значение ключа; добавить `@ApiTags`/`@ApiOperation` (backend/CLAUDE.md, обязательный Swagger); зарегистрировать контроллер в `session.module.ts` и, если модуль ещё не в `include` `commonDocument` (`src/config/swagger.config.ts`), добавить его туда; проверка — эндпоинт виден в `/docs`, ручной вызов через сессию возвращает новое значение ключа.
- [x] 6.3 Убедиться, что регенерация без валидной сессии отклоняется (уже покрывается `SessionAuthGuard` без правок, т.к. маршрут не публичный) — проверка — e2e-тест: запрос без сессии на `/v1/auth/api-key/regenerate` получает 401, новый ключ не создаётся (значение `apiKeyHash` в базе не меняется).

## 7. Итоговая проверка

- [x] 7.1 Прогнать полный набор тестов модуля `session` и `sync/bitrix` (`npm run test -- session`, `npm run test -- bitrix-sync`) — проверка: все тесты зелёные.
- [x] 7.2 Ручной sanity-прогон: создать нового сотрудника через синхронизацию (или self-heal логином) → убедиться, что `apiKeyHash` заполнен; вызвать `/v1/auth/api-key/regenerate` через сессию → получить ключ → выполнить запрос к любому защищённому эндпоинту с заголовком `X-Api-Key` без сессии/cookie → получить успешный ответ; проверка — весь сценарий проходит end-to-end вручную (curl/Postman).
  Прогнано на реальном локальном dev-стенде (Postgres+Redis из docker-compose, пересобранный `dist`): 42/42 существующих сотрудников уже с `apiKeyHash` (backfill применён ранее); `POST /v1/auth/api-key/regenerate` через сессию вернул новый `irk_...`, его SHA-256 совпал со значением в БД; тот же ключ в `X-Api-Key` аутентифицировал `GET /v1/auth/me` без cookie/сессии (200); запрос без заголовка и без сессии — 401; невалидный ключ — 401; временно выставленный `isActive=false` тому же сотруднику — его текущий ключ отклонён (401), после — возвращено `isActive=true`; регенерация без сессии (ни заголовка, ни ключа) — 401, `apiKeyHash` не изменился. В процессе прогона обнаружен и исправлен баг: `POST /v1/auth/api-key/regenerate` принимал аутентификацию и по `X-Api-Key` (не только по сессии), что нарушает spec `auth/api-key#Регенерация недоступна без сессии` — исправлено (см. отчёт), проверено повторным ручным прогоном: с валидным `X-Api-Key` без сессии регенерация теперь отклоняется 401, `apiKeyHash` не меняется, а сама сессионная регенерация и обычная аутентификация по ключу на прочих маршрутах продолжают работать.
- [x] 7.3 `openspec validate "add-employee-api-key-auth" --strict` проходит без ошибок — проверка: команда завершается успешно.
