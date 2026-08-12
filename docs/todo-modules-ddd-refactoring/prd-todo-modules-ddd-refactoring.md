# PRD: Рефакторинг legacy-модулей `src/TODO` в доменную архитектуру

**Дата**: 2026-08-12
**Статус**: Draft
**Источники**: `backend/src/TODO/*` (20 файлов, 1883 строки), `backend/CLAUDE.md`, `backend/src/TODO/CLAUDE.md`, `backend/src/domains/service/CLAUDE.md` (раздел «Функциональность домена, ещё не перенесённая»), эталонные модули `domains/service/modules/{accounting,sales}`

---

## Цель

Перенести три последних legacy-модуля (`deals`, `reports`, `priceMonitoring`) из `src/TODO` в доменную структуру `domains/{service,shop}` со слоистостью domain → application → infrastructure → interface, после чего каталог `src/TODO` удаляется, а весь backend соответствует целевой архитектуре: контракты в `ireports-contracts`, роуты в `routesV1` под `/v1/{service,shop}`, Swagger-документация без исключений.

---

## Пользовательские сценарии

Функциональность для пользователя не меняется — сценарии фиксируют эквивалентность до/после и снятие текущих ограничений:

- Пользователь открывает список сделок / этапы / менеджеров / источники → получает те же данные, что и сейчас, но по путям `/v1/service/...`.
- Пользователь запрашивает отчёт по сервисной воронке и аналитику услуг → те же KPI и разбивки, что и сейчас.
- Пользователь запускает обновление закупочных цен магазина из XLSX → джоба запускается, прогресс виден через SSE/поллинг, результат пишется в Google Sheets — как сейчас.
- Пользователь запускает обновление цен услуг в RemOnline → цены обновляются через кастомное API — как сейчас.
- Разработчик открывает `/docs/service` и `/docs/common` → видит Swagger-документацию мигрированных эндпоинтов (сегодня модули TODO сознательно исключены из OpenAPI, а `getServiceFunnelReportDTO` роняет её генерацию).
- Фронтенд-разработчик берёт формы запросов/ответов из `ireports-contracts` → типы совпадают с backend (сегодня DTO этих модулей живут только в backend).

---

## В скоупе

### 1. `TODO/deals` → interface/application-слой `domains/service/modules/sales`

Целевое место зафиксировано в `domains/service/CLAUDE.md`: «то, что со временем должно стать HTTP-слоем `modules/sales`». Read-side домена уже существует (`LeadEntity`, `DealEntity`, `LEAD_REPOSITORY`), пустые файлы-заготовки `api/sales.routes.ts` и др. заполняются этой миграцией.

**Разбиение:**

| Слой | Что появляется |
|---|---|
| domain | Ничего нового по сущностям — используется существующий read-side `DealEntity` / `LeadEntity`. Новый VO **`DateRange`** (`src/shared/domain/date-range.value-object.ts`): пара `from/to` с инвариантами «обе даты валидны», «from ≤ to» — заменяет ручную валидацию ISO-строк в контроллере. |
| application | Query-сервисы (по образцу `ListSalesPlansService`, без QueryBus): `ListDealsService`, `ListDealCatalogService` (этапы, менеджеры, источники, группы этапов, модели устройств). Новый порт **`DEAL_CATALOG_READER`** для справочников. |
| infrastructure | Реализация каталога поверх Prisma (`BitrixStage`, `BitrixEmployee`, `BitrixLeadSources`, `BitrixDeviceTypes`); N+1 из `getDealsManagers()` заменяется батч-выборкой (прецедент — `findByEmployees` в `motivation-schema.port.ts`). |
| interface | HTTP-контроллеры «один на use case» с `@ApiTags`/`@ApiOperation`; пути — новые константы `routesV1.service.sales.deals.*` → `/v1/service/sales/deals`, `/deals/stages`, `/deals/managers`, `/deals/sources`, `/deals/stage-groups`, `/deals/models`. |

Aggregate root здесь не нужен: модуль чисто читающий, записи и инвариантов состояния нет.

### 2. `TODO/reports` → воронка в `modules/sales` + новый модуль `domains/service/modules/reports`

Модуль режется по источнику данных на две части.

**2а. Отчёт по сервисной воронке (`/reports/service-funnel`) → `modules/sales`** — читает те же `BitrixDeal`, что и сделки:

| Слой | Что появляется |
|---|---|
| domain | VO **`FunnelStageMap`** — сегодняшние захардкоженные массивы stage-ID Bitrix (`inWorkStages`, `waitingInServiceStages`, `inServiceStages`, `loseStages`, `'WON'`, `'3'`) становятся явным value object с инвариантом «этап принадлежит ровно одной группе». VO **`ServiceFunnelKpi`** — результат расчёта (счётчики групп + конверсии), вычисляется доменным сервисом `funnel-kpi.calculator.ts` (перенос `serviceFunnelKPICalculation` из `reports.helpers.ts`). Константа `SERVICE_FUNNEL_CATEGORY_ID` переиспользуется, а не дублируется. |
| application | `GetServiceFunnelReportService` с фильтрами (даты, источники, менеджеры, модели, этапы, группы этапов). |
| interface | Контроллер на `routesV1.service.sales.funnelReport` → `/v1/service/sales/funnel-report`. |

**2б. Аналитика услуг (`/reports/services-analytics`, `/reports/service-categories`) → новый модуль `domains/service/modules/reports`** — читает `RoappServiceOrder`/`RoappServiceCategory`, к воронке отношения не имеет:

| Слой | Что появляется |
|---|---|
| domain | Read-model **`ServiceSale`** (проданная услуга: заказ, услуга, цена, себестоимость, бонус инженера, дата) — entity без aggregate root, записи нет. VO **`PeriodBucket`** — гранулярность разбивки (`day / week / month`) + генерация ключей периодов (перенос `getPeriodBucketKey` / `generatePeriodKeys`). VO **`ServiceMetrics`** — `totalCount, totalRevenue, totalProfit, totalEngineerBonus, avgServicePrice, avgOrderCheck` с инкапсулированной дедупликацией заказов при расчёте среднего чека. |
| application | `GetServicesAnalyticsService`, `ListServiceCategoriesService`; порт **`SERVICE_SALES_SOURCE`**. |
| infrastructure | Prisma-реализация порта поверх `roappServiceOrder` + `roappServiceCategory`. |
| interface | Контроллеры на `routesV1.service.reports.*` → `/v1/service/reports/services`, `/v1/service/reports/service-categories`. |

**Обязательное следствие миграции:** схемы запросов переезжают в `contracts/` и избавляются от `z.coerce.date()` (даты — ISO-строки), что снимает блокировку генерации OpenAPI, зафиксированную в `swagger.config.ts:14-17`.

### 3. `TODO/priceMonitoring` → два модуля `marketing/pricing`: в `domains/shop` и в `domains/service`

Модуль обслуживает оба направления одним классом с 7 зависимостями — режется по направлениям (правило проекта: direction определяется путём `/v1/{service,shop}`, а не параметром). В каждом домене модуль `pricing` размещается внутри саб-группы **`marketing`** (`modules/marketing/pricing`) — `marketing` уже числится среди планируемых модулей домена `service` в `domains/service/CLAUDE.md`, и работа с ценами относится к нему; других модулей внутри `marketing` эта итерация не создаёт.

**3а. `domains/shop/modules/marketing/pricing`** — джоба обновления закупочных цен из XLSX (`update-shop-products-costs`):

| Слой | Что появляется |
|---|---|
| domain | Aggregate root **`PriceImportJob`** — единственный настоящий агрегат всего рефакторинга: id, статус с переходами `CREATED → RUNNING → COMPLETED / FAILED` (инварианты переходов в `validate()`, доменные события по образцу `AccountingPeriod`). VO **`JobProgress`** (`stage`, `processed`, `total`, `message`). VO **`ProductMatch`** (строка файла × сопоставленный товар МойСклад × способ сопоставления × уверенность). VO **`CostChange`** (товар, старая/новая закупочная цена). Доменный сервис категоризации строк (перенос regexp-правил `categorize`). |
| application | Команда `StartPriceImportCommand` + handler (пайплайн: парсинг XLSX → каталог МойСклад → AI-сопоставление → обновление цен → запись результата в Sheets); порты: **`PRICE_IMPORT_JOB_STORE`** (состояние джобы + подписка на прогресс; первая реализация — in-memory, как сейчас, но за портом), **`PRODUCT_MATCHER`** (AI-сопоставление названий), **`RESULT_SHEET_GATEWAY`** (Google Sheets). |
| infrastructure | Адаптеры портов: in-memory store (перенос `PriceMonitoringProgressService`), AI-адаптер (промпты из `priceMonitoring.prompts.ts` — деталь реализации адаптера), Sheets-адаптер, МойСклад — через существующий `domains/shop/integrations/moySklad`. Захардкоженные `SPREADSHEET_ID`, UUID валюты/атрибута и UUID папок каталога (`CATEGORY_MS_FILTER`) переезжают в конфигурацию модуля. |
| interface | Контроллеры на `routesV1.shop.marketing.pricing.*` → `POST /v1/shop/marketing/pricing/import-costs`, `GET /v1/shop/marketing/pricing/import-costs/:id/status`, SSE `GET /v1/shop/marketing/pricing/import-costs/:id`. |

**3б. `domains/service/modules/marketing/pricing`** — обновление цен услуг в RemOnline (`update-service-price`):

| Слой | Что появляется |
|---|---|
| domain | VO **`ServicePriceChange`** (`serviceId`, `price`, `serviceCost` с инвариантами неотрицательности). Агрегат не нужен — синхронная stateless-операция. |
| application | Команда `UpdateServicePricesCommand` + handler: выгрузка услуг, построение путей категорий, генерация XLSX, отправка. |
| infrastructure | Доступ к RoApp — **только через порт `ROAPP_GATEWAY`** (порт расширяется методами `fetchServices` / `fetchServicesCategories` / `updateServices`), устраняя зафиксированное в `domains/service/CLAUDE.md` нарушение — прямые инжекты `RoappService` / `CustomApiRoappService`. |
| interface | Контроллер на `routesV1.service.marketing.pricing.updateServicePrices` → `POST /v1/service/marketing/pricing/update-service-prices`. |

### 4. Сквозные работы (все три модуля)

- Контракты запросов/ответов — сначала в `ireports-contracts`, DTO — тонкие `createZodDto`-обёртки.
- Все новые модули включаются в `include: [...]` соответствующих Swagger-документов (`serviceDocument`, `shopDocument`).
- `ENDPOINTS.md` обновляется: новые пути добавлены, секции TODO-модулей удалены.
- Фронтенд переключается на новые пути (механическая замена базовых URL в API-клиентах); старые пути удаляются без периода совместимости.
- Удаление каталога `src/TODO` целиком (включая `src/TODO/CLAUDE.md`), очистка `app.module.ts` от блока «временно перенесены как есть».
- Устранение мёртвого кода при переносе (не переносится): `SIMILARITY_THRESHOLD`, `WORKER_MODELS`, `VectorCandidate`, `buildFormatNamesPrompt`/`parseFormatNamesResponse` (дубль инлайн-промпта), `uniqueBy`, `groupSoldServicesByPeriod`, пустой `report.entity.ts`, неиспользуемый `DatabaseService` в `PriceMonitoringService`, неиспользуемый импорт `BitrixModule` в `deals.module.ts`.
- Правка устаревших ссылок на удалённый `backend/deprecated` в корневом `CLAUDE.md`; актуализация раздела «ещё не перенесённая функциональность» в `domains/service/CLAUDE.md`.
- Тесты: юнит-тесты на доменные VO/сервисы (расчёт KPI воронки, `ServiceMetrics`, переходы статусов `PriceImportJob`, `FunnelStageMap`), e2e — по образцу `sales-plan.e2e.spec.ts` (сегодня в TODO ноль тестов).

**Рекомендуемый порядок миграции** (по возрастанию стоимости): `deals` → `reports` → `priceMonitoring`.

---

## Не в скоупе

- Legacy-модули `CronModule` и `SalaryModule` (`/salary-rules/*`, `/salaryReport*`) — отдельная миграция, предшественник `modules/accounting`.
- Изменение бизнес-логики: формулы KPI воронки, правила категоризации товаров, AI-промпты, формат XLSX/Google Sheets — переносятся как есть.
- Персистентность джоб `PriceImportJob` в БД / переход на очереди (BullMQ и т.п.) — состояние остаётся in-memory, но за портом `PRICE_IMPORT_JOB_STORE`, чтобы замену можно было сделать без правок application-слоя.
- Мультипарт-загрузка файла вместо base64 в JSON — формат запроса не меняется.
- Период обратной совместимости старых путей (`/deals`, `/reports/*`, `/price-monitoring/*`) — фронтенд переезжает одновременно, алиасы не заводятся.
- Новые фичи в мигрируемых отчётах (новые фильтры, метрики, экспорты).
- Вынос захардкоженных stage-ID Bitrix в настраиваемый пользователем справочник — они становятся доменным VO/конфигом, но UI управления ими не делается.

---

## Технические ограничения

- **Правила `backend/CLAUDE.md` важнее существующего кода** («Приоритет инструкций»): при миграции копируются не паттерны TODO, а слоистость эталонных `modules/accounting` / `modules/sales`; `domain` не импортирует из других слоёв.
- Смена путей — **breaking change для фронтенда**: `/deals` → `/v1/service/sales/deals` и т.д.; деплой backend и frontend по каждому модулю должен быть согласован.
- `getServiceFunnelReportDTO` с `z.coerce.date()` сейчас блокирует OpenAPI — в контрактах даты обязаны быть OpenAPI-совместимыми (ISO-строки).
- Запись в RoApp идёт через два разных API (публичное + кастомное `CustomApiRoappService`) — расширение `ROAPP_GATEWAY` должно скрыть оба за одним портом.
- In-memory состояние джоб не переживает рестарт и не работает при нескольких инстансах — известное ограничение, сознательно сохраняемое в этой итерации (за портом).
- SSE-эндпоинт с heartbeat каждые 20 с (обход таймаута Nginx) должен сохраниться в новой реализации.
- `PriceMonitoringService` держит 7 инжектов и хардкоды (`SPREADSHEET_ID`, UUID валюты, UUID папок МойСклад) — хардкоды переезжают в конфигурацию, но их значения не меняются.
- Кросс-доменный принцип: `service` и `shop` независимы, общий код двух модулей `pricing` не создаётся — только нейтральные примитивы в `src/shared` (например `DateRange`).
- Входящих зависимостей на TODO извне нет (только `app.module.ts` и комментарий в `swagger.config.ts`) — обратных ссылок, мешающих удалению, не существует.

---

## Критерии готовности

### Общие
- [ ] Каталог `backend/src/TODO` удалён; в `app.module.ts` нет блока «временно перенесены как есть».
- [ ] Все схемы запросов/ответов мигрированных эндпоинтов лежат в `ireports-contracts`; DTO — только `createZodDto`-обёртки.
- [ ] Все новые контроллеры имеют `@ApiTags`/`@ApiOperation`, их модули включены в Swagger-документы; `/docs/service`, `/docs/shop`, `/docs/common` генерируются без ошибок (блокер `z.coerce.date()` устранён).
- [ ] Все новые пути объявлены в `routesV1` под `/v1/service` либо `/v1/shop`; `ENDPOINTS.md` обновлён, секции старых путей удалены.
- [ ] Фронтенд работает на новых путях; обращений к `/deals*`, `/reports/*`, `/price-monitoring/*` в коде фронтенда не осталось.
- [ ] Ни один новый модуль не инжектит `DatabaseService`/`PrismaClient` напрямую в application/domain — только порты и `UNIT_OF_WORK`/`PrismaRepository`.
- [ ] `npm run lint`, `npm run test`, `npm run build` проходят.

### deals
- [ ] Шесть эндпоинтов сделок отвечают под `/v1/service/sales/*` теми же данными, что legacy-версии (сверка ответов на одинаковых параметрах).
- [ ] Валидация диапазона дат выполняется VO `DateRange` (невалидная дата и `from > to` → доменная ошибка, а не ручной `BadRequestException`).
- [ ] Выборка менеджеров выполняется без N+1: один запрос вместо запроса на каждого менеджера.

### reports
- [ ] Отчёт воронки отдаётся из `modules/sales`; KPI на одинаковой выборке сделок совпадает с legacy-расчётом (тест на фикстурах).
- [ ] Группировка этапов воронки инкапсулирована в VO `FunnelStageMap`; захардкоженных массивов stage-ID в application/interface-слоях нет.
- [ ] Аналитика услуг и категории отдаются из модуля `reports` (`domains/service/modules/reports`); метрики (`ServiceMetrics`) совпадают с legacy на одинаковой выборке, включая дедупликацию заказов в среднем чеке.
- [ ] Разбивка по периодам (`day/week/month`) воспроизводит текущие ключи периодов (тест на `PeriodBucket`).

### priceMonitoring
- [ ] Оба модуля `pricing` лежат внутри саб-группы `marketing` (`domains/shop/modules/marketing/pricing`, `domains/service/modules/marketing/pricing`).
- [ ] `POST /v1/shop/marketing/pricing/import-costs` запускает джобу и возвращает id; статус и SSE-прогресс доступны, heartbeat сохранён.
- [ ] Переходы статусов `PriceImportJob` защищены инвариантами: завершить незапущенную или перезапустить завершённую джобу нельзя (юнит-тесты агрегата).
- [ ] Состояние джобы доступно только через порт `PRICE_IMPORT_JOB_STORE`; прямых обращений к `Map`/`Subject` из application-слоя нет.
- [ ] `POST /v1/service/marketing/pricing/update-service-prices` обновляет цены услуг; обращения к RoApp идут только через `ROAPP_GATEWAY` — инжектов `RoappService`/`CustomApiRoappService` вне адаптеров гейтвея не осталось.
- [ ] Хардкоды (`SPREADSHEET_ID`, UUID валюты/атрибута, UUID папок категорий) вынесены в конфигурацию модуля; в коде доменного/application-слоя литералов-UUID нет.
- [ ] Перечисленный мёртвый код не перенесён (проверка отсутствия символов в новой структуре).
