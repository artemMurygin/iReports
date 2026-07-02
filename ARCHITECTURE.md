# Модуль расчёта ЗП и мотивации — Архитектура

Версия 1.0 · Стек: **NestJS + Prisma + PostgreSQL + React**

---

## 1. Ключевые решения

| Вопрос | Решение |
|---|---|
| Уровень измерения плана/факта | **Настраиваемый `scope`** на уровне Goal: `PERSONAL` / `DEPARTMENT` / `COMPANY` |
| Состав ЗП | Почасовая оплата + бонусы по целям + **штрафы/корректировки**. Оклад и аванс — заложены в enum `accrualType`, но не реализуются в MVP |
| Направления | `SERVICE` (данные из таблиц `roapp_*`) и `SHOP` (данные из `moy_sklad_*`) |
| Оборачиваемость | Проектируется с **заглушкой** `turnover_snapshots` под будущую интеграцию МойСклад (остатки/обороты). ЗП отдела закупок = отдельная ветка, включается позже |
| Гибкость мотивации | Прогрессия вознаграждения — конфигурируемая кусочная функция (tiers), не хардкод |
| Историзация | Effective-dating правил + снапшот условий в закрытый расчёт (аудит выплат) |

---

## 2. Доменная модель

### 2.1 Enums

```prisma
enum Direction        { SERVICE  SHOP }
enum GoalType         { KPI  TASK }
enum KpiDirection     { SALES  TURNOVER }
enum KpiStat          { REVENUE  MARGIN  MARGIN_MINUS_ENGINEER  PCS  COSTS }
enum Scope            { PERSONAL  DEPARTMENT  COMPANY }
enum RewardType       { PERCENT  FIX }
enum ProgressionMode  { FIXED  LINEAR  MULTIPLIER }
enum AccrualType      { HOURLY  BONUS  PENALTY  ADJUSTMENT  FIXED  ADVANCE } // FIXED/ADVANCE — future
enum RuleStatus       { DRAFT  ACTIVE  ARCHIVED }
enum ReportStatus     { PROJECTED  CLOSED } // PROJECTED — считается на лету, CLOSED — снапшот
```

### 2.2 Ссылка на категорию (без локальной витрины)

Категории у сервиса (`roapp_service_categories`, id `integer`) и магазина
(`moy_sklad_product_folders`, id `text`) — разные деревья с разными типами id.
Локальный справочник-обёртку **не заводим** — он требует постоянной синхронизации
с источниками и быстро рассыхается.

Вместо этого цель/вознаграждение хранят категорию полиморфно — строкой
`categoryExtId` (id в исходной системе). Тип кастуется вручную в слое метрик:
направление цели (`direction`) однозначно задаёт дерево, поэтому отдельный
`CategorySource` не нужен:

- `SERVICE` → `parseInt(categoryExtId)` → `roapp_service_categories`
- `SHOP`    → `categoryExtId` как есть → `moy_sklad_product_folders`

UI-селектор категорий читает деревья **напрямую** из источников через
read-only эндпоинты (см. §5), без локального зеркала. FK на источник не ставим
(разные типы id, кросс-схемная ссылка) — целостность проверяем на уровне
валидации при сохранении правила.

### 2.3 Правило зарплаты

```prisma
model SalaryRule {
  id            Int         @id @default(autoincrement())
  name          String
  payPerHour    Int?        // null = без почасовой части
  isRegular     Boolean     @default(false) // применяется каждый месяц
  validFrom     DateTime    // effective-dating вместо targetMonth
  validTo       DateTime?   // null = бессрочно
  status        RuleStatus  @default(DRAFT)
  goals         Goal[]
  assignments   RuleAssignment[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

// Назначение правила: сотрудник / отдел / должность (гибкая адресация)
model RuleAssignment {
  id           Int         @id @default(autoincrement())
  ruleId       Int
  rule         SalaryRule  @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  employeeId   Int?        // -> bitrix_employees.id (единый employee)
  departmentId Int?        // -> bitrix_departments.id
  @@index([ruleId])
}
```

> `targetMonth` заменён на `validFrom/validTo` + `isRegular`. Это даёт корректную
> историзацию: правка правила не ломает уже закрытые месяцы.
> `owners` вынесены в отдельную таблицу `RuleAssignment`, чтобы поддержать
> адресацию и на сотрудника, и на отдел одновременно.

### 2.4 Цель

```prisma
model Goal {
  id            Int            @id @default(autoincrement())
  ruleId        Int
  rule          SalaryRule     @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  type          GoalType
  direction     Direction
  scope         Scope          @default(PERSONAL)
  name          String
  sortOrder     Int            @default(0)

  // --- только для type = KPI ---
  kpiDirection  KpiDirection?
  measureStat   KpiStat?       // ЧТО меряем для % выполнения плана
  categoryExtId String?        // id категории в источнике (int сервиса / text магазина), каст вручную по direction

  rewardId      Int
  reward        Reward         @relation(fields: [rewardId], references: [id])

  // --- только для type = TASK ---
  taskCompletion TaskCompletion[]
  @@index([ruleId])
}
```

> **Важно:** `measureStat`/`category` в Goal — это метрика для расчёта *процента
> выполнения плана*. То, *от чего платим*, живёт в Reward (`baseStat`/`category`).
> Они могут отличаться: «выполни план по выручке → получи % от маржи».

### 2.5 Вознаграждение и прогрессия

```prisma
model Reward {
  id            Int            @id @default(autoincrement())
  name          String
  type          RewardType     // PERCENT | FIX
  value         Int            // базовый % (в сотых, напр. 1000 = 10%) или фикс-сумма
  baseStat      KpiStat?       // база для percent: от чего считаем (напр. MARGIN_MINUS_ENGINEER)
  categoryExtId String?        // id категории-ограничителя базы (каст по direction цели)
  minAmount     Int?           // нижний порог выплаты (гарант), опционально
  maxAmount     Int?           // потолок выплаты, опционально
  tiers         RewardProgressionTier[]
  goals         Goal[]
}

// Кусочная функция «% выполнения плана → коэффициент к базовому %»
model RewardProgressionTier {
  id          Int             @id @default(autoincrement())
  rewardId    Int
  reward      Reward          @relation(fields: [rewardId], references: [id], onDelete: Cascade)
  fromPct     Int             // включительно, целые проценты
  toPct       Int?            // null = +бесконечность
  mode        ProgressionMode // FIXED | LINEAR | MULTIPLIER
  coef        Float?          // FIXED/MULTIPLIER: коэффициент
  coefFrom    Float?          // LINEAR: коэф. на fromPct
  coefTo      Float?          // LINEAR: коэф. на toPct
  @@index([rewardId])
}
```

Пример вашей прогрессии (0–70 → ×0.5, 70–120 → линейно 0.5→1.0, >120 → ×1.2):

```json
[
  { "fromPct": 0,   "toPct": 70,   "mode": "FIXED",      "coef": 0.5 },
  { "fromPct": 70,  "toPct": 120,  "mode": "LINEAR",     "coefFrom": 0.5, "coefTo": 1.0 },
  { "fromPct": 120, "toPct": null, "mode": "MULTIPLIER", "coef": 1.2 }
]
```

### 2.6 План/факт (ввод плана — через UI)

```prisma
model PlanTarget {
  id           Int         @id @default(autoincrement())
  period       String      // 'YYYY-MM'
  direction    Direction
  scope        Scope
  employeeId   Int?        // для PERSONAL
  departmentId Int?        // для DEPARTMENT
  categoryExtId String?    // id категории в источнике, каст по direction
  stat         KpiStat
  planValue    Int         // план (fact считается на лету из источников)
  @@unique([period, direction, scope, employeeId, departmentId, categoryExtId, stat])
}
```

### 2.7 График работы

```prisma
model WorkShift {
  id            Int       @id @default(autoincrement())
  employeeId    Int       // -> bitrix_employees.id
  date          DateTime  @db.Date
  plannedStart  DateTime? // плановое начало смены
  plannedEnd    DateTime?
  plannedHours  Float     // плановые часы (для прогноза)
  actualHours   Float?    // фактически отработано (для текущей ставки)
  status        String    @default("planned") // planned | worked | absent | vacation | sick
  note          String?
  @@unique([employeeId, date])
  @@index([employeeId, date])
}
```

### 2.8 Задачи (goal.type = TASK)

```prisma
model TaskCompletion {
  id           Int       @id @default(autoincrement())
  goalId       Int
  goal         Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)
  employeeId   Int
  period       String    // 'YYYY-MM'
  completed    Boolean   @default(false)
  completedAt  DateTime?
  approvedById Int?
  @@unique([goalId, employeeId, period])
}
```

### 2.9 Отчёт по ЗП (детализация = аудит)

```prisma
model SalaryReport {
  id          Int          @id @default(autoincrement())
  employeeId  Int
  period      String       // 'YYYY-MM'
  status      ReportStatus @default(PROJECTED)
  factTotal   Int          // начислено на текущий момент
  projected   Int          // прогноз до конца месяца
  closedAt    DateTime?
  lineItems   SalaryLineItem[]
  @@unique([employeeId, period])
}

// Каждая строка = отдельное начисление со ссылкой на источник (для «за что?»)
model SalaryLineItem {
  id          Int          @id @default(autoincrement())
  reportId    Int
  report      SalaryReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  accrualType AccrualType
  goalId      Int?
  rewardId    Int?
  sourceType  String?      // 'roapp_order' | 'moysklad_demand' | 'manual' | 'schedule'
  sourceId    String?      // id заказа/продажи
  label       String       // человекочитаемо: «10% маржи по заказу #123»
  factAmount  Int          // начислено сейчас
  projected   Int          // прогноз
  meta        Json?        // planPct, factPct, coef, base — для расшифровки
  @@index([reportId])
}

// Штрафы и ручные корректировки (ответ на выбранный состав ЗП)
model SalaryAdjustment {
  id          Int          @id @default(autoincrement())
  employeeId  Int
  period      String
  accrualType AccrualType  // PENALTY | ADJUSTMENT
  amount      Int          // может быть отрицательным (штраф)
  reason      String
  createdById Int
  createdAt   DateTime     @default(now())
}
```

### 2.10 Заглушка оборачиваемости

```prisma
// Заполняется будущей интеграцией с МойСклад (остатки/обороты).
// До интеграции таблица пустая; ветка turnover в движке возвращает "нет данных".
model TurnoverSnapshot {
  id           Int      @id @default(autoincrement())
  period       String   // 'YYYY-MM'
  categoryExtId String?
  productId    String?  // -> moy_sklad_products.id
  avgStockCost Int      // средний остаток по себестоимости
  cogs         Int      // себестоимость проданного за период
  turnoverDays Float?   // дни оборачиваемости
  @@index([period])
}
```

---

## 3. Расчётный движок

### 3.1 Пайплайн `/salaryReport`

```
Вход: { employeeId, period }  (period = 'YYYY-MM')

1. Резолв правил
   - собрать SalaryRule, где статус ACTIVE и период попадает в [validFrom, validTo]
   - и правило назначено сотруднику напрямую ИЛИ его отделу (RuleAssignment)

2. Почасовая часть (для каждого правила с payPerHour)
   - fact = payPerHour × сумма WorkShift.actualHours за прошедшие дни
   - projected = payPerHour × сумма WorkShift.plannedHours до конца месяца
   - → LineItem(accrualType = HOURLY)

3. Собрать все Goal из всех правил, отсортировать:
   KPI(SERVICE) → KPI(SHOP) → TASK

4. Для каждого Goal вызвать соответствующий калькулятор (см. 3.2)

5. Применить штрафы/корректировки: SalaryAdjustment за период → LineItems

6. Агрегировать: factTotal = Σ fact, projected = Σ projected
   Вернуть отчёт с детализацией lineItems
```

### 3.2 Стратегия расчёта цели (Strategy pattern)

Ключ выбора калькулятора: `(direction, kpiDirection, measureStat)`.
Интерфейс единый:

```ts
interface GoalCalculator {
  supports(goal: Goal): boolean;
  calculate(ctx: CalcContext): GoalResult; // { lineItems, factPct, projectedPct }
}
```

Общий алгоритм KPI-цели (по вашим шагам а–г):

```
а) Получить план: PlanTarget по (period, direction, scope, employee/dept, category, measureStat)
   Получить факт на текущий момент из источника (см. §4).
   factPct = fact / plan × 100

б) Спрогнозировать: projectedFact = fact / elapsedShare
     где elapsedShare = отработанные плановые часы(или раб.дни) / все плановые за месяц
   projectedPct = projectedFact / plan × 100

в) Получить все заказы/продажи сотрудника за период по category и посчитать
   для каждого базовое начисление:
     base = baseValue(order, reward.baseStat)          // напр. маржа за вычетом ЗП мастера
     rawReward = reward.type=PERCENT ? base × value/10000 : reward.value
     coef = progressionCoef(factPct, reward.tiers)     // кусочная функция
     accrual = clamp(rawReward × coef, reward.minAmount, reward.maxAmount)
   → LineItem на каждый заказ (или агрегат — по настройке)

г) Метрики цели: factPct, projectedPct, planValue, factValue, итог начислений.
   projected по цели = rawReward(projectedFact) × progressionCoef(projectedPct)
```

### 3.3 Прогресс-коэффициент

```ts
function progressionCoef(pct: number, tiers: Tier[]): number {
  const t = tiers.find(t => pct >= t.fromPct && (t.toPct == null || pct < t.toPct));
  if (!t) return 1;
  switch (t.mode) {
    case 'FIXED':      return t.coef;
    case 'MULTIPLIER': return t.coef;
    case 'LINEAR': {
      const span = (t.toPct! - t.fromPct);
      const k = span === 0 ? 0 : (pct - t.fromPct) / span;
      return t.coefFrom! + (t.coefTo! - t.coefFrom!) * k;
    }
  }
}
```

### 3.4 Метод прогноза (run-rate по графику)

Прогноз строится не «по календарю», а по графику работы сотрудника:
`elapsedShare = Σ plannedHours(прошедшие дни) / Σ plannedHours(весь месяц)`.
Это точнее для сменного графика, чем деление на число дней.

---

## 4. Маппинг метрик на реальные таблицы

### 4.1 Сервис (`roapp_*`), атрибуция по `engineer_id` / `manager_id`

| KpiStat | Источник | Формула на позицию `roapp_service_orders` |
|---|---|---|
| `REVENUE` | `roapp_service_orders` | `price × quantity − discount` |
| `COSTS` | `roapp_service_orders` | `cost × quantity` |
| `MARGIN` | `roapp_service_orders` | `revenue − costs` |
| `MARGIN_MINUS_ENGINEER` | `roapp_service_orders` | `revenue − costs − engeneer_salary` |
| `PCS` | `roapp_service_orders` | `Σ quantity` |

Фильтр по категории: `roapp_service.category_id` → `roapp_service_categories`
(дерево через `parent_id`, учитывать `depth` для вложенных категорий).
Период: `roapp_orders.closed_at` (или `done_at` — согласовать).

### 4.2 Магазин (`moy_sklad_*`), атрибуция по `online_manager_id` / `offline_manager_id`

| KpiStat | Источник | Формула на позицию `moy_sklad_demand_positions` |
|---|---|---|
| `REVENUE` | `moy_sklad_demand_positions` | `sum` (уже с учётом discount) |
| `COSTS` | `moy_sklad_demand_positions` | `cost` |
| `MARGIN` | `moy_sklad_demand_positions` | `profit` (готовое поле) |
| `MARGIN_MINUS_ENGINEER` | — | неприменимо к магазину, валидировать на уровне UI |
| `PCS` | `moy_sklad_demand_positions` | `Σ quantity` |

Фильтр по категории: `moy_sklad_products.folder_id` → `moy_sklad_product_folders`
(дерево через `path_name`). Период: `moy_sklad_demands.moment`.

### 4.3 Оборачиваемость (`TURNOVER`)

Требует остатков во времени — **данных пока нет**. Калькулятор возвращает
статус `NO_DATA` и не начисляет, пока не появится интеграция и данные в
`turnover_snapshots`. Формула на будущее: `turnoverDays = avgStockCost / (cogs / днейВпериоде)`.

> **Замечание по консистентности:** в БД встречается двойное написание —
> `engeneer_salary`/`engeneer_bonus` в `roapp_service_orders` и
> `engineer_salary` в `roapp_orders`. В коде движка держать единый enum метрик
> и слой маппинга, чтобы опечатки в схеме не протекали в бизнес-логику.
> Также зафиксировать единицы: все денежные `integer` — **рубли** (уточнить, если копейки).
>
> **Категории:** `categoryExtId` кастуется в провайдере метрик по `direction` —
> `SERVICE` через `parseInt` в `roapp_service_categories` (с обходом дерева по
> `parent_id`), `SHOP` как text в `moy_sklad_product_folders`. Локального
> справочника нет.

---

## 5. API (NestJS)

```
# Правила мотивации
GET    /salary-rules?employeeId&period
POST   /salary-rules
PATCH  /salary-rules/:id
POST   /salary-rules/:id/archive

# Цели и вознаграждения (вложенно или отдельно)
POST   /rewards           PATCH /rewards/:id
POST   /goals             PATCH /goals/:id

# План/факт
GET    /plan-fact?period&direction&scope    # таблица план vs факт (факт на лету)
POST   /plan-targets                        # массовый ввод плана
PATCH  /plan-targets/:id

# График
GET    /work-schedule?employeeId&period
POST   /work-schedule/bulk                  # массовое создание/правка смен
PATCH  /work-shifts/:id

# Задачи
PATCH  /task-completions/:id                # отметить выполнение

# Штрафы/корректировки
POST   /salary-adjustments
GET    /salary-adjustments?employeeId&period

# Главный отчёт
GET    /salaryReport?employeeId&period      # { factTotal, projected, lineItems[] }
POST   /salaryReport/close                  # снапшот месяца (status = CLOSED)

# Оборачиваемость (stub)
GET    /turnover?period                     # 501 / NO_DATA пока нет интеграции
```

---

## 6. Фронтенд (React)

**6.1 Конструктор правил мотивации.** Мастер: назначение (сотрудник/отдел) →
почасовая часть → цели. Каждая цель: тип (KPI/задача), направление, scope,
метрика плана, категория (селект из дерева источника по `direction`), вознаграждение
(тип, %/фикс, база) и визуальный редактор прогрессии — график кривой
коэффициента с перетаскиваемыми точками порогов.

**6.2 План/факт.** Таблица по периоду и направлению: строки — сотрудники/отделы,
столбцы — категории×метрики, ячейки — ввод плана и рядом факт с прогрессом (%).
Массовое сохранение.

**6.3 График работы.** Календарь-сетка (сотрудники × дни месяца), ввод смен,
плановые/фактические часы, статусы (работа/отпуск/больничный). Итоги по часам.

**6.4 Страница ЗП.** Для сотрудника за месяц: крупно — «текущая» и «прогноз».
Ниже — детализация lineItems, сгруппированная (почасовая / KPI-сервис /
KPI-магазин / задачи / штрафы), каждая строка раскрывается в расшифровку
(план, факт, %, коэффициент, база). Кнопка «закрыть месяц» для роли админа.

---

## 7. Риски и открытые вопросы

1. **Оборачиваемость** — нет данных об остатках. Нужна интеграция МойСклад
   (отчёты «Обороты»/«Остатки») перед запуском ветки закупок.
2. **Единый employee** — расчёт завязан на `bitrix_employees` (в нём есть маппинг
   на `roapp_id` и `moy_sklad_id`). Убедиться, что маппинг заполнен для всех.
3. **Категории** — храним `categoryExtId` строкой без FK; корректность
   (существование категории в источнике по `direction`) проверяем валидацией при
   сохранении правила. UI читает деревья напрямую из источников.
4. **Единицы измерения и статусы заказов** — зафиксировать: рубли/копейки; какие
   `status_id`/`state_id` считаются «закрытыми продажами» для факта.
5. **Двойные роли** — если сотрудник и продаёт (online), и обслуживает (engineer),
   правила обоих направлений суммируются — это ожидаемо, проверить на пилоте.

---

## 8. Этапы внедрения

1. **Фундамент:** миграции новых таблиц, enums, read-only эндпоинты категорий
   (проксируют деревья `roapp_service_categories` / `moy_sklad_product_folders`).
2. **Справочные экраны:** график работы + план/факт (нужны как вход для расчёта).
3. **Конструктор правил** + Reward/прогрессия.
4. **Движок `/salaryReport`:** почасовая → KPI сервис → KPI магазин → задачи → штрафы.
5. **Страница ЗП** с детализацией и прогнозом.
6. **Закрытие месяца** (снапшоты) и роли/доступы.
7. **Позже:** интеграция остатков МойСклад → ветка оборачиваемости/закупок.
