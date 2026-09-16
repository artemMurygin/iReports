# Architecture: add-department-head-salary-rules

## Scope

Затрагивает `domains/{service,shop}/modules/accounting` (3 новых вида зарплатного правила, новая
роль, расширение расчётного контекста) и `domains/{service,shop}/modules/warehouse` (отчёт
«Оборачиваемость» сам считает и отдаёт итоговую строку по складу — публичный ответ обоих доменов
меняется, у shop со сменой формы, см. FR5); на frontend — существующую фичу `features/SalaryRuleForm`,
вывод новых типов в отчётах (`features/SalaryAccruals`, `features/SalaryReportData`) и страницу
`pages/GoodsTurnoverReport` (переходит на готовый `totals` из ответа вместо локального пересчёта),
без новых страниц.

---

## Backend — Domain Model

### Entities

| Name | Status | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `DepartmentPercentEntity` (service) | new | нет (child entity в `MotivationSchema`) | `targetRole`, `config.salaryBasis`, `config.category`, `config.percent` | FR2: % от факта выручки/маржи |
| `DepartmentPlanBonusEntity` (service) | new | нет | `targetRole`, `config.salaryBasis`, `config.category`, `config.fixedAmount`, `config.percentBorders` | FR3: фикс-сумма × коэфф. плана выручки/маржи |
| `DepartmentTurnoverBonusEntity` (service) | new | нет | `targetRole`, `config.warehouseId`, `config.category`, `config.fixedAmount`, `config.planTurnoverRatio`, `config.percentBorders` | FR4: фикс-сумма × коэфф. плана оборачиваемости на конкретном складе |
| `DepartmentPercentEntity` (shop) | new | нет | зеркало service-версии | FR2 для shop |
| `DepartmentPlanBonusEntity` (shop) | new | нет | зеркало service-версии | FR3 для shop |
| `DepartmentTurnoverBonusEntity` (shop) | new | нет | зеркало service-версии (`config.warehouseId` — здесь MoySklad-склад) | FR4 для shop |
| `MotivationSchema` | existing | да | `targetType`, `targetId`, `rules: SalaryRule[]` | без изменений; состав `rules` расширяется 3 новыми видами |
| `TurnoverReportSnapshot` (`accounting`/service, new) | new | да (свой repository-порт) | `period`, `warehouseId`, `lines`/`totals` (те же поля, что у строки отчёта) | Собственная entity `accounting`, восстанавливается из `goods_turnover_report_lines` через свой repository-порт — **не** обращается к модулю `warehouse` (правило проекта, root `CLAUDE.md`) |
| `TurnoverReportSnapshot` (`accounting`/shop, new) | new | да (свой repository-порт) | зеркало service-версии, читает `moy_sklad_turnover_report_lines` | то же для shop |
| `GoodsTurnoverReport` (`warehouse`/service) | existing → modified | да | `period`, `lines` | + метод `totals()`; агрегат уже существовал, но использовался только на write-стороне — теперь восстанавливается и на read (Decision 6a) |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| Мотивационная схема | `MotivationSchema` | 4 существующих + 3 новых вида `*Entity` per domain | «каждое правило схемы рассчитывается независимо от результата других» (существующий инвариант, `service/accounting` spec) — не меняется новыми видами |
| Снапшот оборачиваемости для правила (`accounting`, per domain) | `TurnoverReportSnapshot` | — | принадлежность одному `(period, warehouseId)`; никаких новых бизнес-инвариантов сверх формы строк — read-модель для чтения `accounting`, не write-side агрегат |
| Отчёт «Оборачиваемость» (`warehouse`/service, existing) | `GoodsTurnoverReport` | `GoodsTurnoverReportLine[]` | все строки принадлежат периоду агрегата; не более одной строки на пару (категория, склад) — существующие инварианты, не меняются |

### Value Objects

| Name | Поля | Почему VO (immutable/self-validating) |
|---|---|---|
| `TurnoverRatioValueObject` (`accounting`/service, new) | `value: number` | Самостоятельная семантика (коэффициент оборачиваемости), инвариант `value > 0`; используется для `config.planTurnoverRatio` и для факта, который сама `TurnoverReportSnapshot` считает по своим строкам |
| `TurnoverRatioValueObject` (`accounting`/shop, new) | `value: number` | то же, дублируется по домену (design.md, Decision 5) |
| `GoodsTurnoverWarehouseTotal` (`warehouse`/service, new) | `outcomeSum`, `stockSum`, `stockQuantity`, `turnoverRatio: number \| null` | Инкапсулирует формулу «сумма по настоящим корневым строкам + средневзвешенный коэффициент» (Decision 6a); метод `GoodsTurnoverReport.totals()` строит массив таких VO |
| `GoodsTurnoverWarehouseTotal` (`warehouse`/shop, new) | те же поля | Та же формула, независимая реализация (нет объединяющего агрегата — вызывается статически из `GetGoodsTurnoverReportService`, по образцу существующего `TurnoverCoefficient`) |
| `GoodsTurnoverWarehouseTotal` (`accounting`/service, new) | те же поля | Третья независимая реализация той же формулы — внутри `TurnoverReportSnapshot`, без обращения к VO/агрегату `warehouse` (Decision 6b, root `CLAUDE.md`) |
| `GoodsTurnoverWarehouseTotal` (`accounting`/shop, new) | те же поля | то же для shop |
| `FloatPercentSchedule` (shop, existing) | `percentBorders` | без изменений — переиспользуется `DepartmentPlanBonusEntity`/`DepartmentTurnoverBonusEntity` как есть |

### Services

| Service | Слой | Ответственность |
|---|---|---|
| `GetGoodsTurnoverReportService` (`warehouse`/service) | application, existing → modified | восстанавливает агрегат `GoodsTurnoverReport` через репозиторий (а не только строки) и вызывает `.totals()` — сумма/коэффициент больше не считаются инлайн в сервисе (Decision 6a) |
| `GetGoodsTurnoverReportService` (`warehouse`/shop) | application, existing → modified | восстанавливает строки, передаёт в `GoodsTurnoverWarehouseTotal.calculate()`; форма ответа меняется на `{lines, totals}` (**BREAKING**) |
| `TURNOVER_PERFORMANCE_READER` порт (`accounting`/service, new) | domain (port) | контракт «факт. коэффициент оборачиваемости по `warehouseId`+`category` за `period`» |
| `TURNOVER_REPORT_REPOSITORY` порт (`accounting`/service, new) | domain (port) | восстанавливает `TurnoverReportSnapshot` — читает `goods_turnover_report_lines` через **собственный** Prisma-делегат `accounting`, не вызывает `warehouse` (Decision 6b, root `CLAUDE.md`) |
| `GetTurnoverPerformanceService` (`accounting`/service, new) | infrastructure | реализация `TURNOVER_PERFORMANCE_READER` — восстанавливает `TurnoverReportSnapshot` через `TURNOVER_REPORT_REPOSITORY`, считает `GoodsTurnoverWarehouseTotal` своей копией формулы |
| `SHOP_TURNOVER_PERFORMANCE_READER`/`SHOP_TURNOVER_REPORT_REPOSITORY` порты (`accounting`/shop, new) | domain (port) | то же для shop, читает `moy_sklad_turnover_report_lines` своим Prisma-делегатом |
| `GetShopTurnoverPerformanceService` (`accounting`/shop, new) | infrastructure | то же для shop |
| `resolveTurnoverPercentCompletion` (service + shop, new, по одной функции на домен) | domain | `(factRatio / planRatio) * 100`, `null` если `factRatio` недоступен (нет данных за предыдущий период) |
| `BuildServiceCalculationContextService` | application, existing → modified | + строит `context.turnoverPerformance`; `context.salesPerformance` меняет тип значения с `number` на `{ fact, percentCompletion }` (Decision 3) |
| `BuildShopCalculationContextService` | application, existing → modified | то же для shop |
| `serviceSalaryRuleRegistry`/`ServiceSalaryRuleFactory` | domain/application, existing → modified | диспатч десериализации на 3 новых `type` |
| `shopSalaryRuleRegistry`/`ShopSalaryRuleFactory` | domain/application, existing → modified | то же для shop |
| `salary-rule-role-catalog.ts` (service) | domain, existing → modified | новый литерал роли в `ALL_SERVICE_ROLES` |
| `salary-rule-role-catalog.ts` (shop) | domain, existing → modified | новый литерал роли в `ALL_SHOP_ROLES` |
| `SalaryRuleMapper`/`ShopSalaryRuleMapper` | infrastructure, existing → modified | (де)сериализация `props` для 3 новых видов правила |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `DepartmentPercentEntity.calculate` | `context: ServiceCalculationContext` | `CalculationLine` | `round(fact.(turnover\|margin) * percent / 100)` по `category` |
| `DepartmentPlanBonusEntity.calculate` | `context: ServiceCalculationContext` | `CalculationLine` | `round(fixedAmount * multiplier(percentCompletion))` |
| `DepartmentTurnoverBonusEntity.calculate` | `context: ServiceCalculationContext` | `CalculationLine` | `round(fixedAmount * multiplier(resolveTurnoverPercentCompletion(...)))` |
| `TurnoverPerformanceReaderPort.findForScope` | `period: string, warehouseId: string \| number, category: string \| null` | `TurnoverPerformance \| null` | факт по категории склада, либо итог по всему складу (`category = null`, из собственной `TurnoverReportSnapshot`); `null` — недостаточно данных |
| `TURNOVER_REPORT_REPOSITORY.findByPeriodAndWarehouse` | `period, warehouseId` | `TurnoverReportSnapshot \| null` | восстанавливает снапшот строк склада напрямую из БД `accounting`-модуля |
| `GoodsTurnoverReport.totals` | — (метод агрегата) | `GoodsTurnoverWarehouseTotal[]` | по одной записи на склад — сумма по настоящим корневым строкам + средневзв. коэффициент |
| `GetGoodsTurnoverReportService.get`/`getReport` (`warehouse`) | `period, warehouseId?` | `{period?, lines, totals}` | `totals` строится вызовом `GoodsTurnoverReport.totals()` (service) / `GoodsTurnoverWarehouseTotal.calculate(lines)` (shop) |
| `resolveTurnoverPercentCompletion` | `factRatio: number \| null, planRatio: number` | `number \| null` | процент выполнения плана оборачиваемости |

---

## Frontend — UI Model

### Pages

| Page | Route | Структура | Назначение |
|---|---|---|---|
| `SalaryRules` (existing) | `/salaries/rules/new` | `mediator`+`model`+`ui`, `service/`+`shop/` подпапки | без структурных изменений — новые виды правил и роль доступны через уже встроенную `SalaryRuleForm` |
| `SalaryRuleListPage` (existing) | `/salaries/rules` | — | список схем; минимальное изменение — новые типы отображаются в существующих лейблах |
| `GoodsTurnoverReport` (existing → modified) | `/goods-turnover-report` (см. `router.tsx`) | `model`+`ui`, `service/`+`shop/` подпапки | `summarizeGoodsTurnoverRows`/`summarizeShopGoodsTurnoverRows` (`model/{,shop/}goodsTurnoverTree.ts`) удаляются, строка «Итого» рендерится из `totals` ответа API (Decision 6) |

### Features (переиспользуемые модули с бизнес-логикой)

| Feature | Статус | Публичный API (index.ts) | model/ (хуки, api.ts) | Назначение |
|---|---|---|---|---|
| `SalaryRuleForm` | existing → modified | без изменений (корневой компонент формы) | `ruleTypes.ts`/`ruleFormSchema.ts`/`ruleAwards.ts`/`ruleFormConfig.ts`/`roleLabels.ts` (service+shop) — добавляются 3 новых типа + новая роль | форма создания/редактирования зарплатного правила |
| `SalaryAccruals` | existing → modified | без изменений | `model/labels.ts` — лейблы для 3 новых типов | отображение строк начисления |
| `SalaryReportData` | existing → modified | без изменений | `model/labels.ts` — то же | отображение строк зарплатного отчёта |

### UI-компоненты (page-local и shared)

| Component | Слой | Props (основные) | Назначение |
|---|---|---|---|
| `RuleFormCardFields` | `features/SalaryRuleForm/ui/RuleFormCard/ui` (existing → modified) | `type`, `award`, ... | + 3 новые ветки рендера полей по award-типу |
| `FloatPercentFields`/`ThresholdsEditor` | `features/SalaryRuleForm/ui/*` (existing, без изменений) | `percentBorders`, `onChange` | переиспользуется `DepartmentPlanBonusEntity`/`DepartmentTurnoverBonusEntity` формой как есть |
| `CategoryField` (`CategoryCombobox`/`CategoryBottomSheet`) | `features/SalaryRuleForm/ui/CategoryField` (existing, без изменений) | `value: string \| null`, `onChange` | переиспользуется как selector «категория / весь склад/направление» для всех 3 новых видов |
| `WarehouseField` (new) | `features/SalaryRuleForm/ui/WarehouseField` (new) | `value`, `onChange` | обязательный выбор склада для `DepartmentTurnoverBonus` (FR4); аналог по духу уже существующему `pages/GoodsTurnoverReport/ui/{,shop/}WarehouseSelect.tsx`, но заводится заново в `features/` — страница не может быть источником переиспользуемого компонента для фичи (направление импортов FSD) |

### Hooks (model)

| Hook | Расположение | Тип | Возвращает |
|---|---|---|---|
| `ruleFormSchema` (service/shop) | `features/SalaryRuleForm/{service,shop}/model` (existing → modified) | zod-схема | + 3 новых discriminated-union члена |
| `ruleAwards.ts` | `features/SalaryRuleForm/model` (existing → modified) | конфиг форм award-типов | + описания полей для 3 новых award-типов |

### Паттерны, которые нужно учесть при проектировании

- [x] Публичный API фичи только через `index.ts` — не меняется, новые типы не требуют нового
  публичного экспорта
- [x] Запросы к backend — уже оформлены через `model/api.ts` (`queryOptions`) — не требуется новый
  эндпоинт для чтения (создание/обновление правила идёт через уже существующий
  `POST/PATCH .../motivation-schema`)
- [x] Ошибки API — уже нормализуются через `ApiError`, без изменений
- [ ] Mediator — не требуется, страница `SalaryRules` не меняет структуру
- [ ] Слоты вместо children — не затронуто
- [ ] `isInitialLoad`/`isRefreshing` — не затронуто (форма правила не аналитический виджет)
- [x] Новые компоненты — не создаются вовсе, переиспользуются существующие `shared/ui-kit`-компоненты
  формы правил

---

## Diagrams

### 1. Domain Entity Interaction
Miro link: https://miro.com/app/board/uXjVHokBs60=/?moveToWidget=3458764683235824169

### 2. External Modules Interaction
Miro link: https://miro.com/app/board/uXjVHokBs60=/?moveToWidget=3458764683235824805

### 3. Layer Interaction — от Controller до Response
Miro link: https://miro.com/app/board/uXjVHokBs60=/?moveToWidget=3458764683235868507

---

## Confirmation Checklist

- [x] Названия entity/aggregate/VO согласованы
- [x] Названия и сигнатуры ключевых методов сервисов согласованы
- [x] Слои (pages/features/kernel/shared), структура model/ui и паттерны фронта согласованы
- [x] Диаграммы взаимодействия отражают ожидаемую реализацию
- [x] Пользователь подтвердил переход к tasks.md
