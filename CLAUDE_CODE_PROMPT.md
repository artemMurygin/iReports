# Промпт для Claude Code — Модуль расчёта ЗП и мотивации

> Скопируй этот файл целиком в Claude Code как задание. Работай итеративно по
> этапам из раздела «План работ», после каждого этапа останавливайся на ревью.

---

## Контекст

Разрабатываю модуль расчёта заработной платы и мотивации для компании с двумя
направлениями: **сервисный центр Apple** (данные в таблицах `roapp_*`) и
**магазин Apple** (данные в таблицах `moy_sklad_*`). Есть CRM Bitrix
(`bitrix_*`), где `bitrix_employees` — единая сущность сотрудника с маппингом на
`roapp_id` и `moy_sklad_id`.

Стек проекта: **NestJS + Prisma + PostgreSQL** (бэкенд), **React** (фронтенд).
Prisma-миграции уже используются (таблица `_prisma_migrations` присутствует).

Полное описание модели и алгоритмов — в файле `ARCHITECTURE.md` рядом. Следуй ему
как источнику истины. Ниже — сжатая спецификация задачи и критерии приёмки.

## Цель

Гибкая система мотивации: правила → цели → вознаграждения с настраиваемой
прогрессией. Плюс отчёт по ЗП: **текущая и прогнозируемая** сумма за месяц с
детализацией «за что начислено». Плюс визуальные экраны для правил, плана/факта
и графика работы.

## Что уже есть в БД (не менять существующие таблицы)

- Сервис: `roapp_orders`, `roapp_service_orders` (поля `price`, `cost`,
  `quantity`, `discount`, `engeneer_salary`, `engineer_id`), `roapp_service`
  (`category_id`), `roapp_service_categories` (дерево `parent_id`, `depth`),
  `roapp_employees`.
- Магазин: `moy_sklad_demands` (`moment`, `online_manager_id`,
  `offline_manager_id`), `moy_sklad_demand_positions` (`sum`, `cost`, `profit`,
  `quantity`), `moy_sklad_products` (`folder_id`, `buy_price`),
  `moy_sklad_product_folders` (дерево `path_name`).
- Bitrix: `bitrix_employees` (маппинг `roapp_id`, `moy_sklad_id`, `department`),
  `bitrix_departments`.

## Что нужно создать

### 1. Новые Prisma-модели (см. ARCHITECTURE.md §2 — там полная схема)

`SalaryRule`, `RuleAssignment`, `Goal`, `Reward`, `RewardProgressionTier`,
`PlanTarget`, `WorkShift`, `TaskCompletion`, `SalaryReport`, `SalaryLineItem`,
`SalaryAdjustment`, `TurnoverSnapshot`.

Enums: `Direction, GoalType, KpiDirection, KpiStat, Scope, RewardType,
ProgressionMode, AccrualType, RuleStatus, ReportStatus`.

Ключевые требования к модели:
- Правила версионируются через `validFrom/validTo` + `isRegular` (не `targetMonth`).
- `owners` реализованы через `RuleAssignment` (employee ИЛИ department).
- Метрика плана (`Goal.measureStat`) и база выплаты (`Reward.baseStat`) — **разные
  поля**, могут отличаться.
- Прогрессия вознаграждения — таблица `RewardProgressionTier` (кусочная функция),
  НЕ хардкод.
- Категория хранится полиморфно строкой `categoryExtId` (в `Goal`, `Reward`,
  `PlanTarget`). **Локального справочника категорий НЕ создавать** — он требует
  синхронизации. Тип кастуется вручную по `direction`: `SERVICE` → `parseInt` в
  `roapp_service_categories`, `SHOP` → text в `moy_sklad_product_folders`. FK на
  источник не ставить.
- Отчёт ЗП детализируется в `SalaryLineItem` со ссылкой на источник (аудит).

### 2. Read-only эндпоинты категорий (для UI-селектора)

Без локальной витрины: контроллер, отдающий деревья напрямую из источников —
`roapp_service_categories` (для SERVICE) и `moy_sklad_product_folders` (для SHOP).
Только чтение, ничего не дублируем в свои таблицы.

### 3. Расчётный движок (сервис `SalaryCalculationService`)

Реализуй пайплайн `/salaryReport` строго по ARCHITECTURE.md §3:

1. Резолв активных правил на период (по назначению сотруднику/отделу).
2. Почасовая часть: fact по `WorkShift.actualHours`, projected по `plannedHours`.
3. Сбор всех целей, сортировка `KPI(SERVICE) → KPI(SHOP) → TASK`.
4. Для каждой цели — калькулятор по стратегии `(direction, kpiDirection, measureStat)`:
   - план из `PlanTarget`, факт из источника (§4 маппинг метрик);
   - `factPct` и `projectedPct` (прогноз = run-rate по графику работы);
   - перебор заказов/продаж сотрудника, на каждый — базовое начисление,
     умноженное на `progressionCoef(factPct, tiers)`, с `clamp(min,max)`;
   - строки в `SalaryLineItem` с `meta` (planPct, factPct, coef, base).
5. Штрафы/корректировки из `SalaryAdjustment`.
6. Итоги: `factTotal`, `projected`.

Маппинг метрик (реализуй как отдельный слой, чтобы изолировать опечатки в схеме):

- **Сервис** (`roapp_service_orders`, атрибуция `engineer_id`):
  `REVENUE = price*quantity - discount`; `COSTS = cost*quantity`;
  `MARGIN = REVENUE - COSTS`; `MARGIN_MINUS_ENGINEER = MARGIN - engeneer_salary`;
  `PCS = Σ quantity`. Категория через `roapp_service.category_id`. Период — `closed_at`.
- **Магазин** (`moy_sklad_demand_positions`, атрибуция `online_manager_id`/`offline_manager_id`):
  `REVENUE = sum`; `COSTS = cost`; `MARGIN = profit`; `PCS = Σ quantity`.
  Категория через `moy_sklad_products.folder_id`. Период — `moy_sklad_demands.moment`.
- **TURNOVER**: вернуть `NO_DATA` (нет данных об остатках), не начислять.

Прогресс-коэффициент `progressionCoef(pct, tiers)`: FIXED → coef; MULTIPLIER →
coef; LINEAR → `coefFrom + (coefTo-coefFrom) * (pct-fromPct)/(toPct-fromPct)`.

### 4. API (NestJS-контроллеры) — см. ARCHITECTURE.md §5

CRUD для правил/целей/вознаграждений/плана/графика/задач/корректировок и главный
`GET /salaryReport?employeeId&period`, `POST /salaryReport/close`.

### 5. Фронтенд (React) — см. ARCHITECTURE.md §6

Конструктор правил (с визуальным редактором кривой прогрессии), таблица
план/факт, календарь графика работы, страница ЗП (текущая + прогноз + раскрываемая
детализация).

## Критерии приёмки

- [ ] `prisma migrate` проходит; read-only эндпоинты категорий отдают деревья из
      `roapp_service_categories` и `moy_sklad_product_folders`.
- [ ] Каст `categoryExtId` по `direction` покрыт тестом (SERVICE int / SHOP text).
- [ ] Юнит-тесты на `progressionCoef` (все три режима + границы 70/120/0/150%).
- [ ] Юнит-тесты на каждый калькулятор метрик (сервис и магазин) на фикстурах.
- [ ] Интеграционный тест `/salaryReport`: сотрудник с почасовой + KPI-целью
      сервиса + KPI-целью магазина + штрафом → корректные `factTotal`, `projected`,
      непустой `lineItems` с расшифровкой в `meta`.
- [ ] Прогноз считается по графику работы (run-rate), а не по календарным дням.
- [ ] Ветка `TURNOVER` возвращает `NO_DATA` и не ломает отчёт.
- [ ] Правка правила не меняет расчёт закрытого (`CLOSED`) месяца.
- [ ] Денежные значения — целые (рубли), знаковые для штрафов.

## План работ (останавливайся после каждого этапа на ревью)

1. Prisma-модели + enums + миграция + read-only эндпоинты категорий.
2. `progressionCoef` + слой маппинга метрик + юнит-тесты.
3. `SalaryCalculationService` (пайплайн) + интеграционный тест `/salaryReport`.
4. Остальные API-контроллеры (CRUD).
5. Фронтенд: график работы и план/факт.
6. Фронтенд: конструктор правил с редактором прогрессии.
7. Фронтенд: страница ЗП + закрытие месяца.

## Важные ограничения

- Не изменяй существующие `roapp_*`, `moy_sklad_*`, `bitrix_*` таблицы —
  только читай.
- Все начисления должны быть детерминированы и воспроизводимы (аудит).
- Опирайся на `bitrix_employees` как на единого сотрудника; факт по направлениям
  бери через `roapp_id` / `moy_sklad_id`.
- Уточни у меня перед стартом: единицы денег (рубли/копейки) и какие статусы
  заказов/продаж считаются «закрытыми» для факта.
