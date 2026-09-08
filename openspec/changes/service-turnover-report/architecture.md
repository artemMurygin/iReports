# Architecture: service-turnover-report

## Scope
Новый read-модуль `domains/service/modules/warehouse` (первая часть заявленного, но пока не
реализованного модуля `warehouse`): построение, хранение и отдача отчёта по оборачиваемости товаров
направления «Сервис» за месяц, плюс небольшие аддитивные расширения существующих модулей
(`accounting` — экспорт порта; `integrations/custom-api-roapp`, `integrations/roapp`, `sync/roapp` —
новые методы для кастомного эндпоинта и справочника складов).

---

## Backend — Domain Model

### Entities

| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `GoodsTurnoverReport` | new | да | `period: Period` (existing VO), `lines: GoodsTurnoverReportLine[]` | Отчёт за один месяц: набор строк категория×склад + инвариант их уникальности |
| `GoodsTurnoverReportLine` | new | нет (входит в `GoodsTurnoverReport`) | `categoryId`, `warehouseId`, `outcome: GoodsFlowMetric`, `stock: GoodsFlowMetric`, `turnoverRatio: number \| null` | Одна позиция отчёта — показатели категории на складе + коэффициент оборачиваемости |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `GoodsTurnoverReport` | `GoodsTurnoverReport` | `GoodsTurnoverReportLine[]`, `GoodsFlowMetric` (×2 на строку), `Period` (existing) | Уникальность пары `(categoryId, warehouseId)` в пределах периода; `period` — валидный `YYYY-MM` |

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `GoodsFlowMetric` (new) | `quantity: number` (int ≥0), `sum: number` (≥0) | Всегда меняются вместе (пара из ответа ERP `outcome`/`stock`), immutable, самостоятельный смысл — «показатель движения товара» |
| `Period` (existing, `src/shared/domain/period.value-object.ts`) | `value: string` (`YYYY-MM`) | Уже валидирует формат/сравнение периода в `accounting` — переиспользуется, не создаём аналог |

### Services

| Service | Слой | Ответственность |
|---|---|---|
| `BuildGoodsTurnoverReportService` | application | Обходит дерево категорий × склады (D4 design.md), вызывает `ROAPP_GATEWAY.getGoodsFlowReport` на каждую пару, читает остаток прошлого месяца из `GOODS_TURNOVER_REPORT_LINE_REPOSITORY`, вызывает `GoodsTurnoverReportLine.calcRatio(...)`, собирает `GoodsTurnoverReport` |
| `RecalculateOpenGoodsTurnoverPeriodCron` | infrastructure (cron) | `@ProdCron(EVERY_HOUR)`; читает статус `AccountingPeriod('service', period)` через `ACCOUNTING_PERIOD_REPOSITORY`; если открыт — вызывает `BuildGoodsTurnoverReportService` и сохраняет результат |
| `CloseGoodsTurnoverPeriod` | application (event handler) | `@OnEvent('AccountingPeriodClosedDomainEvent')`, фильтр `direction === 'service'`; финальный пересчёт + сохранение снэпшота (D7) |
| `GetGoodsTurnoverReportService` | application | Читает строки за период + справочники категорий/складов, собирает ответ для `GET`-эндпоинта |
| `GoodsTurnoverReportLineRepository` (`GOODS_TURNOVER_REPORT_LINE_REPOSITORY`) | infrastructure | Persistence-порт: `findByPeriod`/`replaceAll` над `GoodsTurnoverReportLine` (Prisma) |
| `ProductCategoryRepository` (`PRODUCT_CATEGORY_REPOSITORY`) | infrastructure | Читает уже существующую `RoappProductCategory` (дерево категорий) — новый порт поверх существующей таблицы |
| `WarehouseRepository` (`WAREHOUSE_REPOSITORY`) | infrastructure | Читает новую `RoappWarehouse` |
| `CustomApiRoappService.getGoodsFlowReport` (расширение) | infrastructure (`integrations/custom-api-roapp`) | Новый метод клиента кастомного RoApp-эндпоинта (D2) |
| `RoappService` + `RoappSyncService.uploadWarehouses` (расширение) | infrastructure (`integrations/roapp`, `sync/roapp`) | Новый метод получения списка складов из публичного API + апсерт в `RoappWarehouse` (D3) |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `BuildGoodsTurnoverReportService.build` | `period: string` | `Promise<GoodsTurnoverReport>` | Строит агрегат за период, перебирая категория×склад через `ROAPP_GATEWAY`; довычисляет `turnoverRatio` через `GoodsTurnoverReportLine.calcRatio(...)` |
| `GoodsTurnoverReportLine.calcRatio` | `stockPreviousSum: number \| undefined` | `number \| null` | Метод сущности: `outcome.sum / ((stockPreviousSum + stock.sum) / 2)` — считается в рублях (сумма), не в штуках; `null` при отсутствии `stockPreviousSum` или нулевом среднем остатке |
| `RoappGateway.getGoodsFlowReport` (расширение существующего порта) | `{ startDate: Date; endDate: Date; categoryId: number; warehouseId: number }` | `Promise<{ outcome: GoodsFlowMetric; stock: GoodsFlowMetric }>` | Один срез категория×склад из кастомного ERP-эндпоинта |
| `GoodsTurnoverReportLineRepositoryPort.replaceAll` | `period: string, lines: GoodsTurnoverReportLine[]` | `Promise<void>` | Полная замена строк периода |
| `GoodsTurnoverReportLineRepositoryPort.findByPeriod` | `period: string` | `Promise<GoodsTurnoverReportLine[]>` | Чтение сохранённых строк |
| `AccountingPeriodRepositoryPort.findByDirectionAndPeriod` (existing, читается) | `'service', period: string` | `Promise<AccountingPeriod \| null>` | Статус периода — нет записи/`isOpen()` = открыт, `isClosed()` = закрыт |
| `GetGoodsTurnoverReportService.get` | `period: string` | `Promise<GoodsTurnoverReportResponse>` | Строки + справочники категорий/складов для ответа `GET` |
| `ProductCategoryRepositoryPort.findAll` | — | `Promise<ProductCategory[]>` | Полное дерево категорий из `RoappProductCategory` |
| `WarehouseRepositoryPort.findAll` | — | `Promise<Warehouse[]>` | Список складов из `RoappWarehouse` |
| `CloseGoodsTurnoverPeriod.handle` | `event: AccountingPeriodClosedDomainEvent` | `Promise<void>` | Финальный пересчёт периода при `direction === 'service'` |

---

## Frontend — UI Model

### Pages

| Page | Route | Структура (ui / +model / +mediator) | Назначение |
|---|---|---|---|
| `GoodsTurnoverReport` (new) | `goods-turnover-report` | `ui/` + `model/` + `mediator/` (по образцу `pages/ServicesReport`) | Выбор месяца, дерево категорий × склады, показатели расхода/остатка (шт/₽) |

### Features (переиспользуемые модули с бизнес-логикой)
Новых `features/*` не заводим — переиспользуем уже существующий page-local паттерн
`pages/ServicesReport/ui/CategoryTreeSelect` (дерево категорий с поиском) и общий
`shared/lib/tree.ts` (`getDirectChildren`, `getSubtreeIds`) вместо изобретения нового дерева.

| Feature | Статус (new/existing) | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| — | — | — | — | Не требуется: логика достаточно узкая для одной страницы (см. `pages/ServicesReport` как прецедент) |

### UI-компоненты (page-local и shared)

| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `CategoryTreeSelect` (переиспользуется как есть) | `pages/ServicesReport/ui` → предлагается поднять в `shared/ui-kit/` при переносе, либо page-local копия в `pages/GoodsTurnoverReport/ui` | `categories`, `selectedId`, `onSelect` | Выбор категории/подкатегории из дерева |
| `WarehouseSelect` (new) | `pages/GoodsTurnoverReport/ui` | `warehouses`, `selectedWarehouseId`, `onSelect` | Переключение между складами — выпадающий селект (не табы: число складов заранее неизвестно и может быть большим), реализуется поверх уже используемого в проекте select/combobox-компонента |
| `PeriodPicker` (new, `shared/ui-kit/`, если ещё нет подходящего) | `shared/ui-kit/organisms` | `period`, `onChange`, `maxPeriod` | Выбор месяца отчёта, включая прошлые периоды |
| `GoodsTurnoverTable` (new) | `pages/GoodsTurnoverReport/ui` | `rows: GoodsTurnoverRow[]` | Таблица категория × (расход шт/₽, остаток шт/₽, коэффициент оборачиваемости — «—» при `null`) для выбранного склада |
| `Layout` (new, по образцу `pages/ServicesReport/ui/Layout.tsx`) | `pages/GoodsTurnoverReport/ui` | `header`, `body` (именованные слоты) | Каркас страницы |

### Hooks (model)

| Hook | Расположение | Тип | Возвращает |
|---|---|---|---|
| `useGoodsTurnoverReportPage` | `pages/GoodsTurnoverReport/model` | state-хук с плоским объектом (по образцу `useSalesPlanPage`) | период, выбранная категория/склад, данные отчёта, `isInitialLoad`/`isRefreshing`, обработчики |
| `api.getGoodsTurnoverReport(period)` | `pages/GoodsTurnoverReport/model/api.ts` | query options factory | `queryOptions({...})` — строки отчёта за период |
| `api.getProductCategories()` / `api.getWarehouses()` | `pages/GoodsTurnoverReport/model/api.ts` | query options factory | Справочники дерева категорий и складов |

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts` — не применимо напрямую (features не заводим), но `pages/GoodsTurnoverReport/index.ts` остаётся точкой входа страницы для роутера
- [x] Запросы к backend — через `api` в `model/api.ts` (`queryOptions({...})`)
- [x] Ошибки API — через `ApiError` в `.catch()`
- [x] Один основной виджет на странице (таблица отчёта) → один `model/useGoodsTurnoverReportPage.ts`-хук, без отдельного `mediator/`, если сложность не вырастет (по аналогии с `pages/SalesPlan`); если появится ≥2 stateful-виджетов — завести `mediator/`, как в `ServicesAnalytics`
- [x] Именованные слоты (`header`/`body`) в `Layout`
- [x] `isInitialLoad`/`isRefreshing` вместо одного `isLoading` — фильтры (месяц/категория/склад) не должны «схлопывать» уже отрисованную таблицу
- [x] Новые компоненты — в `shared/ui-kit/`, не в легаси `shared/ui/`

---

## Diagrams

### 1. Domain Entity Interaction
Miro link: `https://miro.com/app/board/uXjVHp85ca0=/?moveToWidget=3458764683067987193`

### 2. External Modules Interaction
Miro link: `https://miro.com/app/board/uXjVHp85ca0=/?moveToWidget=3458764683067987194`

### 3. Layer Interaction — от Controller до Response
Miro link: `https://miro.com/app/board/uXjVHp85ca0=/?moveToWidget=3458764683067987195`

---

## Confirmation Checklist
- [ ] Названия entity/aggregate/VO согласованы
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы
- [ ] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [ ] Диаграммы взаимодействия отражают ожидаемую реализацию
- [ ] Пользователь подтвердил переход к tasks.md
