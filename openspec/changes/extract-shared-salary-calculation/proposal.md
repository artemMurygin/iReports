## Why

Часть расчётной математики зарплаты — округление сумм, интерполяция бонуса по проценту выполнения
плана (FloatPercent), оркестратор применения правил к строкам расчёта и вычисление ключа охвата для
эффективности продаж — продублирована файл-в-файл между доменами `service` и `shop`, хотя не содержит
ERP-специфики. Это уже задокументировано в `docs/review.md` (раздел «4. Дублирование кода») и
подтверждено графовым аудитом в `docs/service-shop-boundary-violations.md`: правка бага в одной ветке
(например, в интерполяции порогов) не гарантированно попадает в зеркальную копию. Устранять это стоит
сейчас, до того как объём зарплатной логики в `shop` вырастет ещё больше.

## What Changes

- Новый общий модуль в `backend/src/shared/salary-calculation/` (отдельно от технического
  `src/shared/domain/`, см. Impact) с generic-утилитами, объединяющими текущие зеркальные реализации:
  - `roundRubles()` — из `domains/service/modules/accounting/domain/services/money.ts` и
    `domains/shop/modules/accounting/domain/value-objects/money.value-object.ts`.
  - `resolveFloatPercentMultiplier()` / `buildFloatPercentThresholdInfo()` — из `float-percent.ts`
    (service) и `float-percent-schedule.value-object.ts` (shop).
  - `PeriodCalculationOrchestrator<TContext, TRule>` — обобщённый дженериком по типу правила и
    контекста, заменяющий раздельные `period-calculation.orchestrator.ts` в обоих доменах.
  - `scopeKey()` / логика `findForScope()` из `get-sales-performance.service.ts` (обе версии).
- `domains/service/modules/accounting`, `domains/shop/modules/accounting` и соответствующие модули
  `sales` переключаются на импорт этих утилит; собственные файлы-дубликаты удаляются.
- Domain-specific части — `SalaryRuleRegistry`, конкретные Entity-классы правил
  (`PayPerHour`/`OrderPayed`/`ServiceCompleted` в service, `PayPerHour`/`ProductSold`/
  `UsedProductSold` в shop), фабрики правил и ERP-специфичные поля контекста — остаются раздельными
  для `service`/`shop`. Это намеренное архитектурное решение (см. комментарии «issue #57» в коде
  shop-модуля о независимости направлений) и не пересматривается этим изменением.
- Это чистый рефакторинг: наблюдаемые результаты расчёта (суммы, округления, применённые пороги)
  должны остаться идентичными до и после для одних и тех же входных данных. Поведение проверяется
  существующими тестами обоих доменов, перенесёнными на использование общей реализации.

**Не входит в это изменение (Non-goals)**:
- Application-сервисы `get-employee-salary-report.service.ts` /
  `get-department-salary-report.service.ts` (обе версии, ~280 строк, по 8 внедрённых зависимостей) —
  они тоже почти дословно продублированы, но объединение их FACT/PROGNOSE-веток требует отдельного
  архитектурного решения о разделении ответственности между направлениями и по объёму заслуживает
  отдельного change.
- Обратная связность `shop → service` через прямое подключение чужих Prisma-репозиториев
  (`SalaryAccrual`, `BalanceTransaction`, `ErpCashDocument`, `EmployeeDismissal` — см.
  `docs/service-shop-boundary-violations.md` §2.1) — это проблема излишней связности, а не
  дублирования кода, и решается по-другому (вынос в `shared` инфраструктурного контракта, а не
  устранение копипаста).

## Capabilities

Изменение не затрагивает наблюдаемое поведение системы — это внутреннее перемещение чистой расчётной
логики в общий модуль без изменения формул, входов или выходов. Спек-уровневых требований, которые
меняются, нет, поэтому новые/изменённые capability не объявляются; change помечен `skip_specs: true`.

### New Capabilities

_Нет — см. пояснение выше._

### Modified Capabilities

_Нет — см. пояснение выше._

## Impact

- **Код**:
  - `backend/src/shared/salary-calculation/` — новые файлы (общие утилиты расчёта). Намеренно НЕ
    `backend/src/shared/domain/` — та папка сейчас уже содержит смешение технических DDD-базовых классов
    с бизнес-специфичными файлами (`period.value-object.ts`, `percent.ts`,
    `calculation-context.ts`/`calculation-line.ts`, `employee-salary-rules.ts`), что задокументировано в
    `backend/CLAUDE.md` как известный антипаттерн, который это изменение не должно усугублять новыми
    файлами того же рода. Точное разделение обязанностей и решения по каждому файлу — в `design.md`.
  - `backend/src/domains/service/modules/accounting/domain/services/{money,float-percent,period-calculation.orchestrator}.ts` — удаляются, заменяются импортом из `shared/salary-calculation`.
  - `backend/src/domains/shop/modules/accounting/domain/{value-objects/money.value-object,value-objects/float-percent-schedule.value-object,services/period-calculation.orchestrator}.ts` — внутренняя реализация переключается на `shared/salary-calculation` (детали — см. design.md).
  - `get-sales-performance.service.ts` в `domains/service/modules/sales` и `domains/shop/modules/sales` — `scopeKey()` выносится в `shared/salary-calculation`.
  - Все потребители изменяемых файлов (Entity-классы правил, application-сервисы calculation/salary-report в обоих доменах) — обновление импортов.
- **Тесты**: существующие unit-тесты `money`/`float-percent`/`period-calculation.orchestrator` в обоих доменах консолидируются в один набор тестов на общую реализацию; e2e/snapshot-тесты зарплатных отчётов должны продолжать проходить без изменений (поведение неизменно).
- **API/контракты/БД**: не затрагиваются — изменение полностью внутри backend, без изменений схемы Prisma, HTTP-контрактов или фронтенда.
