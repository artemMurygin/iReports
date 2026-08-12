# Ручной сквозной тест: план продаж → закрытие месяца (Фазы 1–13.5)

**Контекст**: backend-часть [`plan-payroll-calculation.md`](./plan-payroll-calculation.md) закрыта
для обоих направлений (`git log` подтверждает Фазы 12/13/13.5 закоммичены, несмотря на неотмеченные
чекбоксы в самом плане). Данные ERP уже выгружены в БД синками — этот документ проверяет расчётный
контур поверх них, а не сами синки.

**Base URL**: без глобального префикса, порт из `PORT` в `.env` (по умолчанию `3000`) — т.е.
`http://localhost:3000/...`. Все тела запросов валидируются `ZodValidationPipe` — некорректная форма
даёт `400` до попадания в домен.

**Перед началом — подставь реальные ID из своей БД**, ничего ниже не берётся из воздуха:
- `employeeId` / `bitrixEmployeeId` / `approvedBy` / `closedBy` / `createdBy` / `confirmedBy` —
  `id` строки в таблице `BitrixEmployee` (Bitrix user id).
- `department` (сервис и магазин) — `id` отдела Bitrix (`UF_DEPARTMENT`), смотри в `BitrixEmployee`
  или в справочнике отделов.
- `category` плана продаж/правил **сервиса** — `Int`, id из `RoappServiceCategory` (для правил на
  услуги) — план и `OrderPayed`/`TaskCompleted` не завязаны на категорию, категория есть только у
  плана и у самого `SalesPerformance`.
- `category` правила `ProductSold`/`UsedProductSold` **магазина** — `String`, id из
  `MoySkladProductFolder` (передавай корневую папку — вложенные раскрываются автоматически на
  бэкенде), либо `null` — "все товары".
- `period` — везде формат `YYYY-MM`, текущий месяц или тот, где точно есть свежие синканные данные.

**Гард**: у `/v1/employee-identity/*` (Фаза 2) единственного в проекте — `PortalAdminGuard`,
нужен заголовок `x-bitrix-auth` с access token администратора портала Bitrix24, иначе `403`. Если
связи уже перенесены разовым скриптом `npm run migrate:employee-identities`, для этого прогона их
трогать не обязательно — только проверить, что у тестового сотрудника есть нужные связи (шаг 0.2).
Все остальные эндпоинты ниже **без гарда** (сознательное решение проекта, см. `ENDPOINTS.md`).

---

## Шаг 0 — предпосылки

**0.1 Убедиться, что у тестового сотрудника есть связи с ERP**, иначе расчёт правил, завязанных на
роль (инженер/менеджер/закупщик), не найдёт его ни в одной позиции.

```
GET /v1/employee-identity/employee/:employeeId
Header: x-bitrix-auth: <admin_token>
```
Что проверяем: массив `EmployeeIdentity[]` — для сквозного теста обоих направлений нужен сотрудник
со связью `system=ROAPP, type=EMPLOYEE_ID` (или `ONLINE_MANAGER_FIELD`) **и** связью
`system=MOY_SKLAD` одновременно — так `grandTotal` отчёта (шаг 13) реально просуммирует оба
направления, а не покажет одно.

**0.2 (опционально) список несопоставленных сотрудников** — если связей не хватает:
```
GET /v1/employee-identity/unmatched
Header: x-bitrix-auth: <admin_token>
```

---

# Часть A — направление `service`

## A1. Шаблон плана (если ещё не заполнен)

```
GET /v1/sales/plan_template?direction=service
```
Что делает: отдаёт дефолтные `turnover`/`margin`/`growthPercent` по отделам/категориям сервиса —
запасной вариант для месяцев без плана-предшественника (Фаза 4).

Если для нужного отдела строки нет:
```
PUT /v1/sales/plan_template
Body:
{
  "direction": "service",
  "department": 12,
  "category": null,
  "turnover": 1000000,
  "margin": 300000,
  "growthPercent": 10
}
```
Upsert по `(direction, department, category)`.

## A2. План месяца — ленивое достраивание

```
GET /v1/sales/plan?direction=service&period=2026-08
```
Что делает: если строк плана на этот месяц ещё нет, **этим же запросом** они создаются — из плана
предыдущего месяца `+ growthPercent` (`source=PREVIOUS_MONTH`) либо из шаблона (`source=TEMPLATE`),
Фаза 4. Что проверяем: массив `SalesPlanResponse[]` не пуст, `status=CREATED` у новых строк.

## A3. (опционально) ручная правка/добавление строки плана

```
POST /v1/sales/plan
Body:
{
  "direction": "service",
  "department": 12,
  "category": null,
  "period": "2026-08",
  "turnover": 1200000,
  "margin": 350000
}
```
`source=MANUAL` всегда. Повтор на ту же комбинацию `(direction, department, category, period)` → `409`.

```
PATCH /v1/sales/plan/:id
Body: { "turnover": 1250000 }
```
Что проверяем: строка переходит в `source=MANUAL`; если была `APPROVED` — сбрасывается в `CREATED`.

```
DELETE /v1/sales/plan/:id
```

## A4. Утверждение плана

Построчно:
```
POST /v1/sales/plan/approve
Body: { "ids": ["<planRowId1>", "<planRowId2>"], "approvedBy": 5 }
```
Или весь месяц по направлению:
```
POST /v1/sales/plan/approve
Body: { "direction": "service", "period": "2026-08", "approvedBy": 5 }
```
Что проверяем: строки переходят в `status=APPROVED`; уже утверждённые не трогаются повторным вызовом.
**Это блокирует закрытие периода (шаг A12)** — без утверждения всех строк `close` вернёт `409`.

## A5. Проверка факта/прогноза

```
GET /v1/sales/salesPerformance/2026-08?direction=service
```
Что делает: план + `SalesFact` (из `RoappOrder`) + `SalesPrognose` (линейная экстраполяция по
прошедшим календарным дням) одним запросом на каждый отдел/категорию — вход для `FloatPercent`.
Что проверяем: `percentCompletion` считается по текущему плану; `fact` соответствует реальным
оплаченным заказам периода в RoApp.

## A6. Типы правил сервиса

```
GET /accounting/salary_role_types
```
Что делает: отдаёт `PayPerHour`/`ServiceCompleted`/`OrderPayed`/`TaskCompleted` + допустимые
`targetRole` для каждого — сверься перед сборкой схемы ниже.

## A7. Мотивационная схема сотрудника (все 4 типа правил сервиса)

```
POST /v1/motivation-schema
Body:
{
  "targetType": "Employee",
  "targetId": 42,
  "name": "Тестовая схема — инженер",
  "rules": [
    {
      "type": "PayPerHour",
      "name": "Почасовая",
      "targetRole": "ENGINEER",
      "config": { "price": 500, "bonus": 0 }
    },
    {
      "type": "ServiceCompleted",
      "name": "За услугу — процент",
      "targetRole": "ENGINEER",
      "config": { "award": { "type": "ServicePercent", "percent": 30 }, "bonus": 0 }
    },
    {
      "type": "OrderPayed",
      "name": "За оплаченный заказ",
      "targetRole": "OFFLINE_MANAGER",
      "config": {
        "award": {
          "type": "FloatPercent",
          "basePercent": 5,
          "salaryBasis": "MARGIN",
          "percentBorders": [
            { "name": "низкий", "fromPlanPercent": 0,   "multiplier": 0.8, "mode": "FIX" },
            { "name": "план",   "fromPlanPercent": 100, "multiplier": 1.0, "mode": "LINEAR" },
            { "name": "перевыполнение", "fromPlanPercent": 120, "multiplier": 1.2, "mode": "FIX" }
          ]
        },
        "bonus": 0
      }
    },
    {
      "type": "TaskCompleted",
      "name": "За задачу",
      "targetRole": "ENGINEER",
      "config": { "award": { "type": "Fixed", "price": 300 }, "bonus": 0 }
    }
  ]
}
```
Что делает: find-or-create по `(targetType, targetId)` — если у сотрудника уже есть строка схемы
(например, созданная со стороны shop, часть B), новая не создаётся, эти правила **добавляются** к
существующей. Ответ: `{ id: "<motivationSchemaId>" }`.

Замени `targetRole`/`award`/`salaryBasis` под реальные роли своего тестового сотрудника — иначе
правило посчитает `0` (не найдёт позиций, где он матчится).

## A8. Источник для `PayPerHour` — часы

```
POST /accounting/employee_hours
Body: { "employeeId": 42, "period": "2026-08", "hours": 160 }
```
Повтор на ту же пару `(employeeId, period)` → `409`. Правка:
```
PATCH /accounting/employee_hours/:id
Body: { "hours": 168 }
```

## A9. Источник для `TaskCompleted` — задача

```
POST /accounting/task_completions
Body: { "employeeId": 42, "period": "2026-08", "description": "Собрал iPhone 13", "createdBy": 42 }
```
Статус сразу `PENDING_CONFIRMATION` — в расчёт **не попадает**, пока не подтверждена:
```
POST /accounting/task_completions/:id/confirm
Body: { "confirmedBy": 5 }
```
(альтернативно `POST /accounting/task_completions/:id/reject` с тем же телом — проверить, что
отклонённая задача не попадает в расчёт).

## A10. Отчёт по сотруднику

```
GET /accounting/salary_report/employee/42/2026-08
```
Что проверяем:
- `directions` — ровно 2 элемента (`service` и `shop`), даже если по `shop` пока пусто/`total=0`.
- В направлении `service`: `isClosed=false`, `total.fact`/`total.prognose` — сумма по всем 4 правилам,
  `rules[]` содержит все 4 типа с ненулевыми суммами (если роли/источники заведены верно).
- Для `OrderPayed`-правила — `floatPercent.fact.{currentThreshold,nextThreshold,diffToNext}` заполнен.
- `salesPerformance` (компактный блок плана) и `isPlanApproved=true` (после шага A4).
- `grandTotal.fact`/`grandTotal.prognose` — сумма по направлениям.

## A11. Отчёт по отделу

```
GET /accounting/salary_report/department/12/2026-08
```
Что проверяем: `employees[]` содержит тестового сотрудника, его `total` совпадает с суммой из шага
A10 (по обоим направлениям — отчёт отдела **не** разбивает по `directions`, `rules` смешаны);
`total` отдела = сумма `employees[].total`.

## A12. Статус периода и закрытие

```
GET /accounting/period/service/2026-08
```
Ожидаем `status="OPEN"` (для периода без записи в БД — тоже `OPEN`, это нормально).

**Негативный сценарий** — попробовать закрыть ДО утверждения плана (если пропустил A4 для какой-то
строки):
```
POST /accounting/period/service/2026-08/close
Body: { "closedBy": 5 }
```
Ожидаем `409` со списком неутверждённых строк в `metadata.rows` (форма — `unapprovedSalesPlanRow`:
`id`/`department`/`category`).

После утверждения **всех** строк месяца — повторить тот же запрос, ожидаем успех: создаётся
неизменяемый снапшот по каждому сотруднику с личной схемой этого направления.

## A13. Проверка закрытого периода

```
GET /accounting/salary_report/employee/42/2026-08
```
Что проверяем: в направлении `service` — `isClosed=true`, `total.prognose=null` (снапшот прогноз не
хранит), `total.fact` совпадает с последним расчётом до закрытия (шаг A10). `grandTotal.prognose`
для закрытого направления берёт `fact` (не `null`), см. комментарий в `ENDPOINTS.md`.

**Регресс**: поменять правило схемы (шаг A7) или план (A3) ПОСЛЕ закрытия — цифры закрытого месяца
не должны измениться (перечитать A13, сравнить).

## A14. Пересчёт / переоткрытие (опционально, если нужно проверить кэш и переоткрытие)

```
POST /accounting/period/service/2026-08/recalculate   → 204 (только для OPEN, для CLOSED — 409)
POST /accounting/period/service/2026-08/reopen
Body: { "confirm": true }
```
Что проверяем: `reopen` без `confirm: true` (или с `false`) отклоняется валидацией тела (`400`) до
домена; успешный `reopen` удаляет снапшот целиком, `GET .../period/service/2026-08` снова `OPEN`.

---

# Часть B — направление `shop`

Тот же сотрудник (`targetId=42`) — так шаг B7 покажет объединённый отчёт по обоим направлениям.

## B1. План и утверждение (переиспользует тот же CRUD, что и A2–A4, просто `direction=shop`)

```
GET /v1/sales/plan?direction=shop&period=2026-08
POST /v1/sales/plan/approve
Body: { "direction": "shop", "period": "2026-08", "approvedBy": 5 }
```

## B2. Факт/прогноз магазина (отдельный эндпоинт, НЕ `direction` в query общего пути)

```
GET /v1/sales/salesPerformance/shop/2026-08
```
Проверить отдельно: `fact.margin` = сумма `MoySkladDemandPosition.profit` (не `turnover - cost`).

## B3. Типы правил магазина

```
GET /shop/accounting/salary_role_types
```
Ожидаем `PayPerHour`/`ProductSold`/`UsedProductSold`/`TaskCompleted` — набор ролей и типов не
пересекается с сервисным (кроме одноимённых типов, у которых разные `config`).

## B4. Мотивационная схема магазина

```
POST /shop/accounting/motivation-schema
Body:
{
  "targetType": "Employee",
  "targetId": 42,
  "name": "Тестовая схема — магазин",
  "rules": [
    {
      "type": "PayPerHour",
      "name": "Почасовая (магазин)",
      "targetRole": "OFFLINE_MANAGER",
      "config": { "price": 400, "bonus": 0 }
    },
    {
      "type": "ProductSold",
      "name": "За продажу — процент от выручки",
      "targetRole": "ONLINE_MANAGER",
      "config": {
        "category": null,
        "award": { "type": "FixedPercent", "percent": 8, "salaryBasis": "REVENUE" },
        "bonus": 0
      }
    },
    {
      "type": "UsedProductSold",
      "name": "БУ техника — закупщик",
      "targetRole": "OFFLINE_PURCHASER",
      "config": {
        "category": null,
        "award": { "type": "Fixed", "price": 200 },
        "bonus": 0
      }
    },
    {
      "type": "TaskCompleted",
      "name": "За задачу (магазин)",
      "targetRole": "OFFLINE_MANAGER",
      "config": { "award": { "type": "Fixed", "price": 250 }, "bonus": 0 }
    }
  ]
}
```
Что делает: тот же find-or-create по `(targetType, targetId)`, что и `POST /v1/motivation-schema`
(A7) — с тем же `targetId=42` правила магазина добавятся к **той же** строке `motivation_schemas`,
не создадут вторую.

## B5. Часы (общая таблица с сервисом — если уже вводил в A8 за тот же период, шаг не нужен)

```
POST /accounting/employee_hours
Body: { "employeeId": 42, "period": "2026-08", "hours": 160 }
```

## B6. Задача магазина (отдельная от сервисной сущность на уровне HTTP, общая таблица `TaskCompletion` с `direction=shop`)

```
POST /shop/accounting/task_completions
Body: { "employeeId": 42, "period": "2026-08", "description": "Продал БУ iPhone", "createdBy": 42 }

POST /shop/accounting/task_completions/:id/confirm
Body: { "confirmedBy": 5 }
```

## B7. Объединённый отчёт сотрудника

```
GET /accounting/salary_report/employee/42/2026-08
```
Что проверяем — это ключевая проверка Фазы 13.5:
- `directions` содержит ОБА направления с ненулевыми `total` (сервис из части A, магазин из части B).
- `grandTotal.fact` = сумма `service.total.fact + shop.total.fact`.
- Каждое направление — свой `isClosed`/`isPlanApproved`/`salesPerformance`.

## B8. Закрытие периода магазина — независимость от сервиса

```
GET /accounting/period/shop/2026-08          → OPEN
POST /accounting/period/shop/2026-08/close
Body: { "closedBy": 5 }
```
**Регрессия направлений** (это то, что специально проверяет Фаза 13.5/issue про независимость):
```
GET /accounting/period/service/2026-08       → должен остаться в том состоянии, что было (CLOSED из A12, не тронут)
GET /accounting/salary_report/employee/42/2026-08
```
Проверяем: `service.isClosed` не изменился от закрытия `shop`; после закрытия `shop` —
`directions[shop].isClosed=true`, `directions[shop].total.prognose=null`, а `service` — как было.

---

## Сводный чек-лист по завершении

- [ ] План продаж создан/утверждён для обоих направлений за тестовый период
- [ ] `SalesPerformance` считает `percentCompletion` для обоих направлений
- [ ] Мотивационная схема одного сотрудника содержит правила обоих направлений в одной строке (find-or-create сработал)
- [ ] Все 4 типа правил сервиса и все 4 типа правил магазина дают ненулевые суммы
- [ ] Отчёт сотрудника показывает `directions[2]` и корректный `grandTotal`
- [ ] Отчёт отдела агрегирует правильно (сумма = сумме сотрудников)
- [ ] Закрытие периода с неутверждённым планом → `409` со списком строк
- [ ] Закрытие периода сервиса не трогает статус/цифры периода магазина и наоборот
- [ ] Закрытый период отдаёт `prognose=null` и замороженный `fact` (снапшот), не пересчитывается при правке схемы/плана после закрытия
- [ ] `reopen` без `confirm:true` → `400`; с `confirm:true` — снапшот удаляется, период снова `OPEN`