# Architecture: shop-turnover-report

## Scope

Backend: новый функциональный срез модуля `domains/shop/modules/warehouse/` (отчёт по
оборачиваемости — доменная модель, чтение/пересчёт, две новые почасовые крон-задачи, доработка
`initialUploadData`), плюс небольшие точечные доработки соседних модулей (`sync/moySklad`,
`ShopAccountingModule`). Frontend: новая страница отчёта в домене «Магазин» и вынос двух кусков
инфраструктуры (`PeriodPicker`, справочник каталога) из `features/SalesPlan` в переиспользуемое
место.

---

## Backend — Domain Model

### Entities

| Name | Status | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `GoodsTurnoverReportLine` | new | да | `period: Period`, `categoryId`, `warehouseId`, `turnoverQuantity`, `turnoverSum: Money`, `stockQuantity`, `stockSum: Money` | Одна строка отчёта — оборот и остаток по категории и складу за месяц. |

**Не моделируются как доменные сущности** (по аналогии с уже принятым в `sync/moySklad` подходом —
это синхронизированные справочники/сырые данные без бизнес-инвариантов, читаются напрямую через
репозитории/сервисы, не через доменные агрегаты): `MoySkladStore`, `MoySkladStock`,
`MoySkladDemand`/`MoySkladDemandPosition`, `MoySkladProductFolder`. Они показаны на диаграмме 1 как
read-only зависимости.

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `GoodsTurnoverReportLine` | `GoodsTurnoverReportLine` | `Period`, `Money` × 2 | Период в формате `YYYY-MM`; количества и суммы неотрицательны; уникальность `(period, categoryId, warehouseId)` обеспечивается на уровне репозитория/БД. |

Отчёт не моделируется как один большой агрегат «на весь период» — каждая строка (категория ×
склад) является независимым экземпляром агрегата; пересчёт периода это массовая операция
репозитория (`replaceForPeriod`), а не загрузка одного огромного агрегата с сотнями дочерних строк.

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `Period` (existing, `src/shared/domain/period.value-object.ts`) | `value: string` (`YYYY-MM`) | Уже есть в проекте и переиспользуется `accounting`/`sales`; валидирует формат, даёт `previous()` — ровно то, что нужно для «остатка прошлого месяца» в коэффициенте. |
| `Money` (new, `domains/shop/modules/warehouse/domain/value-objects/money.value-object.ts`) | `kopecks: number` | Суммы оборота/остатка — в копейках (в отличие от `Money` в `shop/accounting`, который хранит рубли) — единица измерения другая, поэтому не переиспользуется существующий `Money` из `accounting` (та же изоляция, что и между `service`/`shop` версиями `Money`, см. issue #57). Инвариант: неотрицательное целое. |
| `TurnoverCoefficient` (new, `domains/shop/modules/warehouse/domain/value-objects/turnover-coefficient.value-object.ts`) | `ratio: number \| null` | Инкапсулирует формулу и явное различие «коэффициент = 0» / «коэффициент не рассчитан» (см. `design.md` D8) — голый `number \| null`, гуляющий по слоям, легко перепутать с ошибкой; VO с `isAvailable()` делает это явным. |

### Services

| Service | Слой | Ответственность |
|---|---|---|
| `RebuildGoodsTurnoverReportService` | application | Пересчитывает и полностью заменяет строки отчёта для периода: агрегирует оборот из `MoySkladDemand`/`MoySkladDemandPosition`, берёт остаток из последнего подходящего снимка `MoySkladStock`, обходит дерево категорий через `ProductFolderTreeService`. |
| `GetGoodsTurnoverReportService` | application | Читает строки текущего и предыдущего периода, считает `TurnoverCoefficient` по каждой строке, маппит в DTO ответа. |
| `GoodsTurnoverReportRepository` (порт `GOODS_TURNOVER_REPORT_REPOSITORY` + Prisma-реализация) | application (порт) / infrastructure (реализация) | `findByPeriod`, `replaceForPeriod` — единственная точка записи/чтения `GoodsTurnoverReportLine`. |
| `ProductFolderTreeService` (existing, `sync/moySklad/product-folder-tree.service.ts`) | infrastructure (вне `warehouse`, сознательно — чистый доступ к `MoySkladProductFolder`) | Обход дерева категорий; переиспользуется как есть. |
| `MoySkladSyncService` (existing, расширяется) | infrastructure (`sync/moySklad`) | Новые методы: `uploadStores()`, `uploadStockSnapshot()` (почасовой снимок через `async=true`), `backfillHistoricalStockSnapshots(fromDate)` (разовый бэкфилл через легаси `stockMoment`/`stockStore`); существующий `uploadCreatedDemands` дополняется маппингом `storeId`. |
| `GoodsTurnoverReportCron` | infrastructure (cron) | `@ProdCron(EVERY_HOUR)` — пересчёт текущего открытого месяца через `RebuildGoodsTurnoverReportService`, если период не закрыт. |
| `MoySkladStockSyncCron` | infrastructure (cron) | `@ProdCron(EVERY_HOUR)` — вызывает `MoySkladSyncService.uploadStockSnapshot()`. |
| `GoodsTurnoverPeriodClosedHandler` | application (`@OnEvent('ShopAccountingPeriodClosedDomainEvent')`) | При закрытии периода направления «Магазин» — финальный пересчёт и фиксация снэпшота. |
| `GetGoodsTurnoverReportHttpController` / `GetShopStoresHttpController` | interface | HTTP-поверхность (см. D10 в `design.md`). |

### Method Signatures

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `RebuildGoodsTurnoverReportService.rebuild` | `period: Period` | `Promise<void>` | Полный пересчёт строк отчёта периода. |
| `GetGoodsTurnoverReportService.getReport` | `period: Period, warehouseId?: string` | `Promise<GoodsTurnoverReportLineDto[]>` | Строки отчёта + коэффициент, с опциональным фильтром по складу. |
| `TurnoverCoefficient.calculate` (static) | `turnoverSum: Money, previousStockSum: Money \| null, currentStockSum: Money` | `TurnoverCoefficient` | Формула из D8; `previousStockSum === null` → `isAvailable() === false`. |
| `GoodsTurnoverReportRepository.replaceForPeriod` | `period: Period, lines: GoodsTurnoverReportLine[]` | `Promise<void>` | Транзакционная замена всех строк периода (unit-of-work). |
| `GoodsTurnoverReportRepository.findByPeriod` | `period: Period` | `Promise<GoodsTurnoverReportLine[]>` | Чтение строк периода. |
| `MoySkladSyncService.uploadStores` | — | `Promise<void>` | Синк справочника складов (`GET /entity/store`). |
| `MoySkladSyncService.uploadStockSnapshot` | — | `Promise<void>` | Один почасовой снимок остатков (`async=true`) → новые строки `MoySkladStock`. |
| `MoySkladSyncService.backfillHistoricalStockSnapshots` | `fromDate: Date` | `Promise<void>` | Разовый бэкфилл месячных снимков через легаси `stockMoment`/`stockStore`. |

---

## Frontend — UI Model

### Pages

| Page | Route | Структура | Назначение |
|---|---|---|---|
| `GoodsTurnoverReport` (new) | `/shop/warehouse/goods-turnover-report` (предлагается, по аналогии с `/shop/warehouse/catalog`) | `ui/GoodsTurnoverReportPage.tsx` + единственный `model/useGoodsTurnoverReportPage.ts` (по образцу `useSalesPlanPage` — один mediator-хук без отдельной папки `mediator/`, т.к. виджеты страницы (дерево+таблица, фильтр склада, период) управляются одним плоским состоянием) | Отчёт по оборачиваемости: дерево категорий с оборотом/остатком/коэффициентом, фильтр по складу, выбор месяца. |

### Features

| Feature | Статус | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `GoodsTurnoverReport` (new) | new | реэкспорт корневого `GoodsTurnoverReportView` | `useGoodsTurnoverReport(period, warehouseId?)` (queryOptions на `GET /v1/shop/warehouse/goods-turnover-report/:period`), `useShopStores()` (queryOptions на `GET /v1/shop/warehouse/stores`) в `model/api.ts` | Данные и состояние отчёта по оборачиваемости. |

**Рефакторинг существующего (нужен для соблюдения границ FSD, не опционален):**
- `getShopCatalog()` сейчас лежит внутри `features/SalesPlan/model/api.ts` и не реэкспортируется
  через `index.ts` фичи — новая фича не может его использовать напрямую (кросс-импорт из чужой
  `model/` запрещён). Выносится в `shared/api/shopCatalog.ts` (чистая инфраструктура, без бизнес-
  логики — подходит под `shared/`), `queryKey` сохраняется как есть для обратной совместимости кэша;
  `features/SalesPlan` и новая `features/GoodsTurnoverReport` обе читают его оттуда.
- `PeriodPicker` (+`formatPeriodLabel`/`shiftPeriod` из `features/SalesPlan/model/format.ts`) —
  второй потребитель (эта фича) означает применение уже сформулированного в проекте правила
  («паттерн, начавший повторяться в ≥2 фичах — выносится в `shared/`»): переносится в
  `shared/ui-kit/molecules/PeriodPicker/` вместе с хелперами форматирования.

### UI-компоненты (page-local и shared)

| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `CategoryTreeTable` (new) | `pages/GoodsTurnoverReport/ui/CategoryTreeTable/` (свой подмодуль `model`+`ui`: логика раскрытия/сворачивания строк дерева — самостоятельная) | `rows: GoodsTurnoverReportLineDto[]`, `categories: CatalogResponse`, `expandedIds`, `onToggle` | Дерево категорий (через `shared/lib/tree.ts#buildTree`) с колонками оборот/остаток (₽ и шт.)/коэффициент. |
| `CoefficientCell` (new) | `pages/GoodsTurnoverReport/ui/CategoryTreeTable/ui` | `coefficient: number \| null` | Рендер значения коэффициента либо `—` при `null` (см. `TurnoverCoefficient.isAvailable()`), без интерпретации отсутствия как нуля. |
| `WarehouseFilter` (new) | `pages/GoodsTurnoverReport/ui/` | `stores: ShopStore[]`, `value`, `onChange` | Выбор склада; собирается из существующих атомов `shared/ui-kit` (Select). |
| `PeriodPicker` (existing → promoted) | `shared/ui-kit/molecules/PeriodPicker/` | `period`, `onChange` | Переиспользуется как есть из `features/SalesPlan`. |

### Hooks (model)

| Hook | Расположение | Тип | Возвращает |
|---|---|---|---|
| `useGoodsTurnoverReportPage` | `pages/GoodsTurnoverReport/model/` | mediator state-хук | `{ period, warehouseId, rows, categories, isInitialLoad, isRefreshing, setPeriod, setWarehouseId }` |
| `useGoodsTurnoverReport` | `features/GoodsTurnoverReport/model/` | query options factory | `queryOptions` для `useQuery`/`prefetchQuery` |
| `useShopStores` | `features/GoodsTurnoverReport/model/` | query options factory | `queryOptions` для списка складов |

### Паттерны, которые нужно учесть при проектировании
- [x] Публичный API фичи только через `index.ts` (реэкспорт корневого UI-компонента)
- [x] Запросы к backend — через query options factory в `model/api.ts` (`queryOptions({...})`), не голыми async-функциями
- [x] Ошибки API нормализуются через `ApiError` (`shared/errors/apiError.ts`) в `.catch()` запроса
- [ ] Для страницы с несколькими stateful-виджетами — `mediator/`-компонент без условного рендера — **не требуется**: один плоский хук страницы достаточен (как в `useSalesPlanPage`), отдельной папки `mediator/` не заводим
- [x] Layout/контейнерные компоненты принимают именованные слоты (`header`/`body`/`footer`), а не `children`
- [x] Разделение `isInitialLoad` / `isRefreshing` вместо одного `isLoading` — нужно: смена склада/периода не должна "схлопывать" уже отрисованное дерево (`placeholderData: keepPreviousData`)
- [x] Новые компоненты — в `shared/ui-kit/`, не в `shared/ui/`

---

## Diagrams

### 1. Domain Entity Interaction
Агрегат `GoodsTurnoverReportLine`, VO (`Period`, `Money`, `TurnoverCoefficient`) и read-only
зависимости на синхронизированные справочники/данные (`MoySkladProductFolder`, `MoySkladStore`,
`MoySkladStock`, `MoySkladDemand`).
Miro link: `https://miro.com/app/board/uXjVHpAFrjk=/?moveToWidget=3458764683084235090`

### 2. External Modules Interaction
Две почасовые крон-задачи (синк остатков, пересчёт отчёта), разовый `initialUploadData`, вызовы
МойСклад (асинхронный отчёт остатков + легаси-эндпоинт для бэкфилла), зависимость на
`ShopAccountingModule`/`ShopAccountingPeriodClosedDomainEvent`.
Miro link: `https://miro.com/app/board/uXjVHpAFrjk=/?moveToWidget=3458764683084235088`

### 3. Layer Interaction — от Controller до Response
Путь чтения `GET /v1/shop/warehouse/goods-turnover-report/:period`: контроллер → сервис → репозиторий
(текущий + предыдущий период) → БД, расчёт `TurnoverCoefficient`.
Miro link: `https://miro.com/app/board/uXjVHpAFrjk=/?moveToWidget=3458764683084235089`

---

## Confirmation Checklist
- [x] Названия entity/aggregate/VO согласованы (`GoodsTurnoverReportLine`, `Money`, `TurnoverCoefficient`, переиспользуемый `Period`)
- [x] Названия и сигнатуры ключевых методов сервисов согласованы
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы, включая вынос `PeriodPicker` и `getShopCatalog` в shared
- [x] Диаграммы взаимодействия отражают ожидаемую реализацию
- [x] Пользователь подтвердил переход к tasks.md
