# Plan: Рефакторинг legacy-модулей `src/TODO` в доменную архитектуру

**PRD**: [prd-todo-modules-ddd-refactoring.md](./prd-todo-modules-ddd-refactoring.md)
**Дата**: 2026-08-13

Порядок модулей — по возрастанию стоимости (из PRD): `deals` → `reports` → `priceMonitoring`. Каждый модуль закрывается парой «backend-фазы → frontend-фаза», старые роуты удаляются вместе с переездом фронта — без периода совместимости.

---

## Фазы реализации

### Фаза 1: Tracer Bullet — список сделок через все слои

**Цель**: Первый эндпоинт `TODO/deals` проходит полный путь новой архитектуры (contracts → interface → application → domain → infrastructure) и виден в Swagger — шаблон для всех остальных фаз.
**Что затрагивает?** backend, contracts

**Задачи:**
- [ ] Схема запроса/ответа списка сделок в `ireports-contracts`; DTO — тонкая `createZodDto`-обёртка.
- [ ] VO `DateRange` в `src/shared/domain/date-range.value-object.ts` (инварианты: валидные даты, `from ≤ to`, доменная ошибка вместо ручного `BadRequestException`) + юнит-тесты.
- [ ] `ListDealsService` в `modules/sales/application` поверх существующего read-side (`DealEntity`/`LeadEntity`), без инжекта `DatabaseService`.
- [ ] Контроллер `list-deals.http.controller.ts` на `routesV1.service.sales.deals.root` (`GET /v1/service/sales/deals`) с `@ApiTags`/`@ApiOperation`; модуль включён в `serviceDocument` Swagger.
- [ ] E2e-тест: ответ нового эндпоинта совпадает с ответом legacy `GET /deals` на одинаковых параметрах.

**Когда готово**: `GET /v1/service/sales/deals?from&to` отдаёт те же данные, что legacy `/deals`; невалидный диапазон дат отклоняется доменной ошибкой из `DateRange`; эндпоинт виден в `/docs/service`.

---

### Фаза 2: Справочники сделок и вывод `TODO/deals` из эксплуатации

**Цель**: Все шесть эндпоинтов сделок работают из `modules/sales`; каталог `TODO/deals` удалён.
**Что затрагивает?** backend, contracts

**Задачи:**
- [ ] Порт `DEAL_CATALOG_READER` + Prisma-реализация (этапы, менеджеры, источники, группы этапов, модели устройств); выборка менеджеров — одним батч-запросом вместо N+1.
- [ ] Схемы справочников в `contracts/`; пять контроллеров на `routesV1.service.sales.deals.*` (`/stages`, `/managers`, `/sources`, `/stage-groups`, `/models`).
- [ ] Тесты: паритет ответов пяти справочников с legacy; тест на отсутствие N+1 (один запрос на менеджеров).
- [ ] Удаление `TODO/deals` (вместе с неиспользуемым импортом `BitrixModule`), снятие `DealsModule` из `app.module.ts`.
- [ ] `ENDPOINTS.md`: секция `/deals*` удалена, новые пути добавлены.

**Когда готово**: Шесть эндпоинтов отвечают под `/v1/service/sales/deals*` теми же данными, что legacy; каталога `TODO/deals` не существует; `npm run lint && npm run test && npm run build` зелёные.

---

### Фаза 3: Фронтенд — переезд сделок на новые пути

**Цель**: Фронтенд работает с `/v1/service/sales/deals*`; старых путей `/deals*` в коде нет.
**Что затрагивает?** frontend

**Задачи:**
- [ ] Замена базовых URL в API-клиентах сделок на `routesV1`-пути; типы — из обновлённого `ireports-contracts`.
- [ ] Проверка страниц, использующих сделки/справочники (список сделок, фильтры по этапам/менеджерам/источникам).
- [ ] Тест/поиск по коду: обращений к `/deals*` не осталось.

**Когда готово**: Все экраны сделок работают на новых путях; grep по фронтенду не находит `/deals`.

---

### Фаза 4: Воронка сервиса в `modules/sales`

**Цель**: Отчёт `service-funnel` отдаётся из домена; захардкоженные stage-ID инкапсулированы в VO.
**Что затрагивает?** backend, contracts

**Задачи:**
- [ ] VO `FunnelStageMap` (группы этапов: inWork / waitingInService / inService / lose / won / нецелевые; инвариант «этап ровно в одной группе») + юнит-тесты; переиспользование `SERVICE_FUNNEL_CATEGORY_ID` без дублирования.
- [ ] VO `ServiceFunnelKpi` + доменный сервис `funnel-kpi.calculator.ts` (перенос `serviceFunnelKPICalculation`); юнит-тест на фикстурах: KPI совпадает с legacy-расчётом.
- [ ] Схема фильтров отчёта в `contracts/` — даты ISO-строками, без `z.coerce.date()`.
- [ ] `GetServiceFunnelReportService` (фильтры: даты, источники, менеджеры, модели, этапы, группы этапов) + контроллер на `routesV1.service.sales.funnelReport` (`GET /v1/service/sales/funnel-report`).
- [ ] E2e-тест: паритет ответа с legacy `/reports/service-funnel` на одинаковых параметрах.

**Когда готово**: `GET /v1/service/sales/funnel-report` возвращает те же KPI и сделки, что legacy; захардкоженных массивов stage-ID вне VO `FunnelStageMap` нет.

---

### Фаза 5: Модуль `reports` (аналитика услуг) и вывод `TODO/reports`; разблокировка Swagger

**Цель**: Аналитика услуг и категории работают из нового модуля `domains/service/modules/reports`; `TODO/reports` удалён; OpenAPI генерируется без обходных исключений.
**Что затрагивает?** backend, contracts

**Задачи:**
- [ ] Домен модуля `reports`: read-model `ServiceSale`, VO `PeriodBucket` (day/week/month, генерация ключей периодов — перенос `getPeriodBucketKey`/`generatePeriodKeys`) и VO `ServiceMetrics` (метрики + дедупликация заказов в среднем чеке) + юнит-тесты (ключи периодов и метрики совпадают с legacy).
- [ ] Порт `SERVICE_SALES_SOURCE` + Prisma-реализация поверх `roappServiceOrder`/`roappServiceCategory`; схемы запросов в `contracts/` (без `z.coerce.date()`).
- [ ] `GetServicesAnalyticsService`, `ListServiceCategoriesService` + контроллеры на `routesV1.service.reports.*` (`/v1/service/reports/services`, `/v1/service/reports/service-categories`); модуль в Swagger.
- [ ] E2e-тесты: паритет обоих ответов с legacy; смоук-тест генерации OpenAPI (`/docs/*` поднимаются без ошибок).
- [ ] Удаление `TODO/reports` (включая мёртвые `uniqueBy`, `groupSoldServicesByPeriod`, пустой `report.entity.ts`), снятие `ReportsModule` из `app.module.ts`, обновление `ENDPOINTS.md`.

**Когда готово**: Оба эндпоинта отвечают из модуля `reports` с паритетом метрик; каталога `TODO/reports` нет; Swagger-документы генерируются — блокер `z.coerce.date()` устранён.

---

### Фаза 6: Фронтенд — переезд отчётов на новые пути

**Цель**: Фронтенд работает с воронкой и аналитикой по новым путям.
**Что затрагивает?** frontend

**Задачи:**
- [ ] Переключение воронки на `GET /v1/service/sales/funnel-report`, аналитики и категорий — на `/v1/service/reports/*`; типы из `contracts/`.
- [ ] Проверка страниц воронки и аналитики услуг (фильтры, разбивка по периодам).
- [ ] Поиск по коду: обращений к `/reports/*` (legacy) не осталось.

**Когда готово**: Экраны воронки и аналитики работают на новых путях; grep не находит старых `/reports/` вызовов.

---

### Фаза 7: `domains/service/modules/marketing/pricing` — цены услуг через `ROAPP_GATEWAY`

**Цель**: Сервисная половина `priceMonitoring` живёт в саб-группе `marketing`; RoApp — только через порт.
**Что затрагивает?** backend, contracts

**Задачи:**
- [ ] Расширение порта `ROAPP_GATEWAY` методами `fetchServices` / `fetchServicesCategories` / `updateServices` (публичное + кастомное API скрыты за одним портом).
- [ ] VO `ServicePriceChange` (`serviceId`, `price`, `serviceCost`, инварианты неотрицательности) + юнит-тесты; схема запроса в `contracts/`.
- [ ] `UpdateServicePricesCommand` + handler (выгрузка услуг, пути категорий, генерация XLSX, отправка) — без прямых инжектов `RoappService`/`CustomApiRoappService`.
- [ ] Контроллер на `routesV1.service.marketing.pricing.updateServicePrices` (`POST /v1/service/marketing/pricing/update-service-prices`); Swagger; e2e/интеграционный тест с замоканным гейтвеем.
- [ ] `ENDPOINTS.md` обновлён; grep: инжектов `RoappService`/`CustomApiRoappService` вне адаптеров гейтвея не осталось.

**Когда готово**: Обновление цен услуг работает по новому пути; обращения к RoApp идут только через `ROAPP_GATEWAY`.

---

### Фаза 8: `domains/shop/modules/marketing/pricing` — агрегат `PriceImportJob`

**Цель**: Доменное ядро джобы импорта цен готово и покрыто юнит-тестами (без инфраструктуры).
**Что затрагивает?** backend

**Задачи:**
- [ ] Aggregate root `PriceImportJob`: статусы `CREATED → RUNNING → COMPLETED / FAILED`, инварианты переходов в `validate()`, доменные события (по образцу `AccountingPeriod`).
- [ ] VO `JobProgress` (`stage`, `processed`, `total`, `message`), `ProductMatch` (строка × товар × способ × уверенность), `CostChange` (товар, старая/новая цена).
- [ ] Доменный сервис категоризации строк (перенос regexp-правил `categorize`).
- [ ] Юнит-тесты агрегата: завершить незапущенную и перезапустить завершённую джобу нельзя; тесты VO и категоризации.

**Когда готово**: Агрегат и VO собраны в `domains/shop/modules/marketing/pricing/domain`, юнит-тесты переходов статусов и категоризации зелёные.

---

### Фаза 9: Shop pricing — порты, адаптеры и пайплайн импорта

**Цель**: Команда импорта закупочных цен работает через порты; хардкоды вынесены в конфигурацию.
**Что затрагивает?** backend, contracts

**Задачи:**
- [ ] Порты `PRICE_IMPORT_JOB_STORE` (состояние + подписка на прогресс), `PRODUCT_MATCHER` (AI-сопоставление), `RESULT_SHEET_GATEWAY` (Google Sheets).
- [ ] Адаптеры: in-memory store (перенос `PriceMonitoringProgressService`), AI-адаптер (промпты из `priceMonitoring.prompts.ts` — деталь адаптера, без дубля `buildFormatNamesPrompt`/`parseFormatNamesResponse`), Sheets-адаптер; МойСклад — через существующий `domains/shop/integrations/moySklad`.
- [ ] Вынос хардкодов в конфигурацию модуля: `SPREADSHEET_ID`, UUID валюты/атрибута, UUID папок (`CATEGORY_MS_FILTER`); мёртвый код (`SIMILARITY_THRESHOLD`, `WORKER_MODELS`, `VectorCandidate`) не переносится.
- [ ] `StartPriceImportCommand` + handler: парсинг XLSX (base64 в JSON, формат не меняется) → каталог МойСклад → AI-сопоставление → обновление цен → запись результата в Sheets; схема запроса в `contracts/`.
- [ ] Интеграционные тесты пайплайна с замоканными портами; grep: литералов-UUID в domain/application нет.

**Когда готово**: Хендлер прогоняет полный пайплайн на моках; состояние джобы доступно только через `PRICE_IMPORT_JOB_STORE`; хардкодов в domain/application не осталось.

---

### Фаза 10: Shop pricing — HTTP/SSE и вывод `TODO/priceMonitoring`; финальная зачистка

**Цель**: Импорт цен доступен по новым путям с прогрессом; `src/TODO` удалён целиком, документация актуализирована.
**Что затрагивает?** backend

**Задачи:**
- [ ] Контроллеры на `routesV1.shop.marketing.pricing.*`: `POST /v1/shop/marketing/pricing/import-costs` (fire-and-forget, ответ `{ id }`), `GET .../:id/status`, SSE `GET .../:id` с heartbeat 20 с; Swagger (`shopDocument`).
- [ ] E2e-тест: запуск джобы → поллинг статуса → SSE-прогресс с heartbeat.
- [ ] Удаление `TODO/priceMonitoring` и всего каталога `src/TODO` (включая `src/TODO/CLAUDE.md`); очистка `app.module.ts` от блока «временно перенесены как есть»; `ENDPOINTS.md` — секция `/price-monitoring/*` удалена.
- [ ] Правка устаревших ссылок на `backend/deprecated` в корневом `CLAUDE.md`; актуализация раздела «ещё не перенесённая функциональность» в `domains/service/CLAUDE.md`; удаление TODO-комментария из `swagger.config.ts`.
- [ ] Финальная проверка: `npm run lint`, `npm run test`, `npm run build`; grep — ни один модуль не инжектит `DatabaseService`/`PrismaClient` в application/domain.

**Когда готово**: Джоба работает по новым путям (SSE + heartbeat сохранены); каталога `src/TODO` не существует; документация и `ENDPOINTS.md` актуальны; линт/тесты/сборка зелёные.

---

### Фаза 11: Фронтенд — переезд price-monitoring на новые пути

**Цель**: Фронтенд работает с импортом цен по путям `marketing/pricing`.
**Что затрагивает?** frontend

**Задачи:**
- [ ] Переключение вызовов на `/v1/shop/marketing/pricing/import-costs` (+ `/status`, SSE) и `/v1/service/marketing/pricing/update-service-prices`; типы из `contracts/`.
- [ ] Проверка сценария целиком: загрузка XLSX → прогресс по SSE → результат; запуск обновления цен услуг.
- [ ] Поиск по коду: обращений к `/price-monitoring/*` не осталось.

**Когда готово**: Оба сценария работают на новых путях; grep по фронтенду не находит `/price-monitoring`; во всём фронтенде не осталось ни одного legacy-пути (`/deals`, `/reports`, `/price-monitoring`).
