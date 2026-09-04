# Нарушения границы Service ↔ Shop — граф-аудит backend

Дата: 2026-08-27. Метод: knowledge-граф `backend/` (graphify, AST-экстракция + семантика) +
точечная проверка находок грепом/чтением исходников. Область: `backend/src` целиком (973 файла
кода). Это не diff-ревью и не замена `docs/review.md` (код-ревью от 2026-08-13, ветка
`feat/todo-modules-ddd-refactoring`) — документ **дополняет и обновляет** раздел «2. Кросс-импорты и
нарушения границ» того ревью на основании автоматического обхода всех прямых edges (imports/calls/
references) между модулями, а не выборочного грепа.

## ⚠️ Главное расхождение с `docs/review.md`

`docs/review.md:104-105` утверждает:

> Не найдено: обратных импортов `service` ← `shop` нет ни одного (грепом `from ['"].*domains/shop`
> внутри `domains/service` — пусто) — связность между доменами строго однонаправленная.

**Это больше не так.** Повторный грep на текущем состоянии кода:

```
$ grep -rln "from ['\"].*domains/shop" backend/src/domains/service/
```

находит **8 файлов** с обратными импортами `service ← shop` (см. раздел 2.2). Судя по всему, они
появились после 13.08 вместе с фичей единого кассового документа ERP (`ErpCashDocument`) и новым
тестом `close-accounting-period.direction-independence.spec.ts`. Вывод старого ревью о строгой
однонаправленности связности устарел и должен быть скорректирован.

## Как читать этот документ

- **[Уже задокументировано]** — находка совпадает с тем, что `docs/review.md` уже описал и признал
  осознанным решением. Здесь не переоткрывается заново, только даётся ссылка и уточнённые цифры.
- **[Новое]** — находка, отсутствующая в `docs/review.md` — либо потому что код появился после
  13.08, либо потому что находка выходит за рамки того, что проверялось вручную (`review.md` целиком
  сфокусирован на паре `AccountingPeriod`/`SalesPlan`; граф вскрыл кратно больше конкретных файлов).
- **[Не является нарушением]** — граф формально пометил связь как кросс-доменную, но по факту это
  либо CLI-скрипт, либо документация, либо тестовая инфраструктура — не архитектурная утечка.

Направление связи везде `источник → цель` (кто импортирует/вызывает кого).

---

## 1. Сводная таблица по всем парам модулей

Посчитано напрямую по графу (5142 узлов/17499 edges), агрегировано по модульным «бакетам» (домен ×
модуль). Показаны только пары с прямой связью в обход `shared/kernel` (`src/shared`,
`src/infrustructure`) — то есть то, что реально нарушает заявленную независимость `service`/`shop`.

| Источник | Цель | Edges | Статус |
|---|---|---:|---|
| `Shop.Accounting` | `Service.Accounting` | 414 | Частично задокументировано, частично новое (§2.1) |
| `Shop.Sales` | `Service.Sales` | 103 | Уже задокументировано (§3, review.md) |
| `Shop.Accounting` | `Service.Sales` | 35 | Уже частично задокументировано (§4) |
| `Service.Accounting` | `Shop.Accounting` | 36 | **Новое**, обратное направление (§2.2) |
| `Shop.Integrations(MoySklad)` | `Service.Accounting` | 18 | **Новое**, обратное направление (§2.2) |
| `Shop.Other` | `Service.Other` | 14 | Не нарушение — доки `CLAUDE.md` (§5) |
| `Service.Accounting` | `Shop.Integrations(MoySklad)` | 4 | **Новое**, обратное направление (§2.2) |
| **Итого прямых Service↔Shop связей** | | **624** | |
| `WorkSchedule` (сквозной модуль) | `Service.Accounting` | 21 | **Новое** (§2.4) |
| `Shared/Infra` | бизнес-код (разные) | 33 | По большей части не нарушение — CLI-скрипты (§5) |

## 2. Новые находки (отсутствуют в `docs/review.md`)

### 2.1 `Shop.Accounting → Service.Accounting` — шире, чем задокументировано (414 edges, 63 файла-цели)

`review.md:87-94` описывает как осознанно переиспользуемые только **3 порта**:
`ACCOUNTING_PERIOD_REPOSITORY` / `ACCOUNTING_PERIOD_SNAPSHOT` / `ACCOUNTING_CALCULATION_CACHE` (+ их
Prisma-реализации) и `accounting-cache-freshness.ts`. По графу это подтверждается (35+32+30+13 = 110
из 414 edges), но остальные **304 edges** идут в объекты, которых в ревью нет вообще:

| Цель в `Service.Accounting` | Edges | Что именно | Откуда (Shop) |
|---|---:|---|---|
| `salary-accrual.port.ts` + `.entity.ts` + `.repository.ts` (impl!) | 30+8+2=40 | Порт, сущность **и Prisma-репозиторий** `SalaryAccrual` | `close-accounting-period.handler.ts`, `create/delete-shop-payout*.handler.ts`, `accounting.module.ts` |
| `balance-transaction.port.ts` + `.entity.ts` + `.repository.ts` (impl!) | 21+10+2=33 | Порт, сущность **и Prisma-репозиторий** `BalanceTransaction` | `create/delete-shop-payout*.handler.ts`, `accounting.module.ts` |
| `erp-cash-document-repository.port.ts` + `.entity.ts` + `.repository.ts` (impl!) | 15+5+2=22 | ERP-кассовый документ целиком (порт+сущность+репозиторий) | `create/delete-shop-payout*.handler.ts`, `accounting.module.ts` |
| `employee-dismissal.port.ts` + `.repository.ts` (impl!) | 12+2=14 | Порт+репозиторий увольнения сотрудника | `close-accounting-period.handler.ts`, `accounting.module.ts` |
| `erp-period-sync.port.ts` + `erp-period-sync-runner.service.ts` | 7+8=15 | Общий раннер синхронизации периода с ERP | `moysklad-erp-period-sync.adapter.ts` **implements** сервисный порт, `accounting.module.ts` |
| `erp-cash-sync.helper.ts` | 7 | Хелпер-функции построения кассового документа | `create-payout.handler.ts` (`calls`) |
| `get-accounting-period.service.ts`, `get-close-period-preview.service.ts`, `get-erp-cash-config.service.ts`, `get-salary-accrual.service.ts` | 6 каждый (24) | Application-сервисы **без shop-версии вообще** — единый сервис на оба направления | Собственные HTTP-контроллеры Shop (`get-shop-*.http.controller.ts`) вызывают их напрямую |
| Мапперы (`to-accounting-period-response.ts`, `to-salary-accrual-response.ts`, `to-balance-transaction-response.ts`, `to-erp-cash-document-response.ts`) | 3 каждый (12) | Presentation-слой Service используется для ответов Shop-эндпоинтов | `close/create/delete-shop-*.handler.ts` |
| Command-классы accrual (`accrue-period-salary-accruals`, `accrue-salary-accrual-document/line`, `adjust-salary-accrual-line`, `recalculate/reopen-accounting-period`, `unaccrue-salary-accrual-line`) | 2 каждая (14) | Shop-контроллеры диспатчат **сервисные** CQRS-команды напрямую, без своих shop-команд | `accrue/adjust/recalculate/reopen/unaccrue-shop-*.http.controller.ts` |
| Domain-события/исключения (`salary-accrual-documents-created.domain-event.ts`, `accounting-period.exception.ts`, `balance-transaction.exception.ts`, `salary-payout.exception.ts`, `erp-cash.exception.ts`) | 4+8+6+4+4=26 | Прямой импорт доменных типов Service | Тесты и хендлеры Shop |
| In-memory тестовые репозитории Service (`in-memory-salary-accrual/balance-transaction/erp-cash-document.repository.ts`) | 10+6+6=22 | Тестовая инфраструктура Service переиспользуется в тестах Shop | `*.spec.ts` Shop |

**Итог по 2.1:** реальный периметр совместно используемого кода между Shop- и Service-accounting в
~4 раза шире, чем зафиксировано в `review.md` — это не только `AccountingPeriod`/кэш-freshness, а
почти весь стек зарплатных выплат (`SalaryAccrual`, `BalanceTransaction`, `ErpCashDocument`,
`EmployeeDismissal`, синхронизация периода с ERP, мапперы ответов, CQRS-команды accrual). При этом
**в `accounting.module.ts` напрямую wire'ится 8 конкретных Prisma-репозиториев Service**
(`salary-accrual.repository.ts`, `balance-transaction.repository.ts`,
`employee-dismissal.repository.ts`, `accounting-period.repository.ts`,
`accounting-period-snapshot.repository.ts`, `accounting-calculation-cache.repository.ts`,
`erp-cash-document.repository.ts`, `erp-cash-config.provider.ts`) — не порты, а конкретные классы с
Prisma-запросами. Это самая сильная форма связности: рефакторинг реализации репозитория в Service
может незаметно сломать сборку DI-контейнера Shop.

### 2.2 Двусторонняя связь по ERP Cash Document — появилась после 13.08, ломает «однонаправленность» (54 edges)

Новая функциональность единого кассового документа теперь **идёт в обе стороны**:

**Service → Shop (8 файлов, ранее такого не было):**
- `backend/src/domains/service/modules/accounting/accounting.module.ts:12-13,115` — импортирует
  `MoyskladModule`, `MoyskladCashDocumentAdapter` и `SHOP_ERP_CASH_DOCUMENT_PORT` напрямую из
  `domains/shop/integrations/moySklad` и `domains/shop/modules/accounting/application/ports`.
- `create-balance-transaction.handler.ts:15-16`, `delete-balance-transaction.handler.ts:12-13` —
  инжектят `SHOP_ERP_CASH_DOCUMENT_PORT` / `ErpCashDocumentPort as ShopErpCashDocumentPort`.
- `erp-cash-config.provider.ts:6` — импортирует `shopErpCashConfig` из
  `domains/shop/modules/accounting/config/erp-cash.config`.
- 3 e2e-теста (`payout`, `balance-transactions`, `balance-summary`) импортируют
  `SHOP_ERP_CASH_DOCUMENT_PORT` для моков.

**Shop → Service (обратно, та же фича):**
- `moysklad-cash-document.adapter.ts` (+`.spec.ts`) в `domains/shop/integrations/moySklad`
  импортирует `ErpCashConfigRepositoryPort`/`ERP_CASH_CONFIG_REPOSITORY`,
  `ErpCashDocumentRepositoryPort`/`ERP_CASH_DOCUMENT_REPOSITORY`, `ErpCashConfig`, `ErpCashDocument`
  — всё из `domains/service/modules/accounting`.

Итог: кассовый документ ERP — это, по сути, **общая подсистема**, физически размазанная по обоим
доменам с циклическим импортом друг друга (`Service.accounting.module` ↔
`Shop.moysklad-cash-document.adapter`). Ни в `review.md`, ни в `CLAUDE.md` доменов эта
двунаправленность не упомянута и не обоснована.

### 2.3 `Shop.Sales → Service.Sales` — задокументированный паттерн (§3), но граф даёт полный список (103 edges, 23 файла)

`review.md` описывает только сам факт «CRUD плана продаж диспатчится через общий CommandBus» и
явные исключения `AccountingPeriod`/`SalesPlan`. Граф уточняет масштаб:

- **39 edges** — `sales-plan.port.ts`/`sales-plan-template.port.ts` (порты) + `SalesPlan(Template)
  Repository` (Prisma-реализации, импортируются в `sales.module.ts` напрямую).
- **11 edges** — сущность `SalesPlan` напрямую в `sales-performance.value-object.ts` (доменный
  слой Shop!) — это именно то место, которое `review.md:95-103` уже разобрал и назвал осознанным
  исключением. Подтверждено графом, не новое.
- **16 edges** — `ensure-sales-plans-for-period.service.ts` — сервис Service, вызываемый из
  `get-sales-performance.service.ts` и `sales-plan-auto-creation.cron.ts` — **не упомянут
  в review.md**, отдельный сквозной сервис создания планов продаж на период.
- **~30 edges** — команды CRUD (`create/update/delete/approve-sales-plan`,
  `put-sales-plan-template`) и их handler'ы — это ровно тот CRUD-паттерн, что уже описан в
  `review.md:184-187` как «диспатч через общий CommandBus, бизнес-логика не скопирована» —
  задокументировано, не новое.

### 2.4 `WorkSchedule → Service.Accounting` — сквозной модуль зависит от одного бизнес-домена (21 edges, новое)

`work-schedule.module.ts` и его командные хендлеры (`delete/upsert-work-schedule-entry.handler.ts`)
напрямую импортируют:

- `EnsurePeriodNotClosedService` (`domains/service/modules/accounting/application/services/`)
- `ACCOUNTING_PERIOD_REPOSITORY` / `AccountingPeriodRepository` (порт **и** Prisma-реализация)

`backend/src/modules/work-schedule` — заявленный как **сквозной** модуль вне `domains/*`
(`backend/CLAUDE.md` явно относит `employee-identity`/аналогичные модули к общим, не привязанным к
одному домену). Однако проверка «период не закрыт» перед правкой графика жёстко завязана на
Service-специфичный `EnsurePeriodNotClosedService`/`AccountingPeriodRepository` — у Shop-домена своя
отдельная реализация периода (`domains/shop/modules/accounting/domain/entities/accounting-period...`
переиспользует ту же Service-сущность, см. §2.1, но методы `EnsurePeriodNotClosedService` и
`ACCOUNTING_PERIOD_REPOSITORY` — конкретно Service-провайдер). **Открытый вопрос, требующий
проверки**: правки графика работы сотрудников Shop-домена вообще защищены проверкой «период
закрыт», или эта защита фактически работает только для Service-сотрудников? Не найдено грепом
эквивалентного вызова с shop-специфичным репозиторием периода в `work-schedule.module.ts`.

**Рекомендация**: либо `EnsurePeriodNotClosedService` должен принимать порт периода параметром (не
захардкоженную Service-реализацию), либо в `WorkSchedule` должна быть собственная,
direction-агностичная проверка через общий интерфейс из `shared/`.

### 2.5 `src/shared/infrastructure/sync-lock/direction-sync-lock.spec.ts` — тест shared-kernel завязан на Service (минор, новое)

Тест общей инфраструктуры (`src/shared/infrastructure/sync-lock/`) импортирует `RoappSyncCron`,
`RoappSyncService`, `RoappErpPeriodSyncAdapter` — все три из `domains/service/...`. Тест
Shared-компонента не должен знать о конкретной ERP-интеграции одного домена; для проверки
direction-agnostic блокировки было бы чище использовать фейковый/мок-адаптер, а не тянуть реальные
классы Service.

## 3. Уже задокументировано в `docs/review.md` — граф подтверждает, без новых деталей

- `accounting.module.ts:93-108` переиспользует `ACCOUNTING_PERIOD_*`/кэш-порты Service — граф
  подтверждает 97 edges (35+32+30) в эти три порта — см. `review.md:87-94`.
- `accounting-cache-freshness.ts` импортируется из Shop напрямую — граф подтверждает 13 edges — см.
  `review.md:79-86`.
- `sales-performance.value-object.ts` импортирует доменную сущность `SalesPlan` — граф
  подтверждает 11 edges — см. `review.md:95-103`.
- CRUD плана продаж (`create/update/delete/approve-sales-plan`) диспатчится из Shop через общий
  CommandBus без копирования бизнес-логики — см. `review.md:184-187`.
- `src/shared/initialUploadData.ts` — CLI-скрипт, импортирует sync-сервисы обоих доменов — уже явно
  признано ожидаемым, не утечкой — см. `review.md:104-110`.

## 4. `Shop.Accounting → Service.Sales` (35 edges) — расчёт зарплаты нуждается в плане продаж

Отдельная от §2.3 пара: не Shop.Sales, а именно **Shop.Accounting** обращается к Service.Sales.
Единственная цель — `SalesPlanRepositoryPort`/`SALES_PLAN_REPOSITORY`
(`sales-plan.port.ts`) + метод `.findByDirectionAndPeriod()`, из:
`close-accounting-period.handler.ts`, `get-shop-department/employee-salary-report.service.ts`,
`accounting.module.ts` (+ их тесты). Бизнес-причина ясна: расчёт зарплаты в Shop должен
учитывать план продаж, который физически хранится и управляется в Service-домене. Способ
реализации, однако, не самый чистый — Shop зависит от порта, определённого внутри
`domains/service/...`, а не от нейтрального контракта. См. также разбор этой же пары в переписке
(добавлен как контекст, не дублируется здесь целиком).

## 5. Не является нарушением — граф ошибся в классификации

- **`Shop.Other → Service.Other` (14 edges)** — единственная цель `src/domains/service/CLAUDE.md`,
  источник `src/domains/shop/CLAUDE.md`. Это связи между **документами** (`conceptually_related_to`,
  `semantically_similar_to`, `shares_data_with`) из семантической экстракции графа, не импорты кода.
- **`src/shared/filter.md → domains/shop/CLAUDE.md`** — то же самое, документ-документ.
- **CLI/миграционные скрипты в `src/shared/*.ts`** (`migrateEmployeeIdentities.ts`,
  `migrateWorkScheduleHours.ts`, `exportRoappOrders.ts`) —
  импортируют `AppModule` и конкретные бизнес-сервисы обоих доменов. Ровно та же логика, что
  `review.md:104-110` уже применил к `initialUploadData.ts`: это одноразовые CLI-точки входа (`npm
  run migrate-*`), а не часть runtime-приложения — ожидаемо, не архитектурная утечка. Физически они
  лежат в `src/shared/`, что и заставило граф пометить их как «shared-kernel зависит от бизнес-кода»
  — в реальности это просто неудачное расположение скриптов рядом с настоящим kernel-кодом
  (стоило бы вынести в отдельный `scripts/` вне `src/shared`, чтобы не путать со собственно
  переиспользуемым доменным ядром).

## 6. Рекомендации

**Новые, от этого аудита:**
1. Физически перенести весь периметр §2.1 (`SalaryAccrual`, `BalanceTransaction`, `ErpCashDocument`,
   `EmployeeDismissal` — порты, сущности и особенно **Prisma-репозитории**) в `src/shared`, если они
   действительно direction-агностичны — по той же логике, что `review.md` уже предложил для
   `AccountingPeriod`/кэша. Сейчас `accounting.module.ts` напрямую подключает 8 чужих
   Prisma-репозиториев — самый рискованный вид связности в этом аудите.
2. Разобраться с двунаправленной связью ERP Cash Document (§2.2) — либо явно задокументировать её
   как общую подсистему (как сделано для `AccountingPeriod`) и вынести в `shared`, либо это
   непреднамеренный архитектурный дрейф, который стоит развернуть обратно.
3. Проверить, защищены ли правки графика работы Shop-сотрудников проверкой «период не закрыт»
   (§2.4) — похоже на нишевый, но реальный пробел в бизнес-логике, а не просто вопрос архитектурной
   чистоты.
4. Обновить `docs/review.md:104-105` — убрать или скорректировать утверждение о строгой
   однонаправленности `shop → service`, добавить ссылку на этот документ.
5. Вынести CLI-скрипты `src/shared/{migrateEmployeeIdentities,migrateWorkScheduleHours,
   exportRoappOrders,initialUploadData}.ts` из `src/shared` в
   отдельную `scripts/`-директорию вне рантайм-кода — устранит ложные срабатывания при будущих
   графовых/статических проверках границ и просто более понятно организационно.
6. Заменить прямой импорт `RoappSyncCron`/`RoappSyncService`/`RoappErpPeriodSyncAdapter` в
   `direction-sync-lock.spec.ts` на мок/фейк — тест общей инфраструктуры не должен знать о
   конкретной ERP-интеграции одного домена.

**Уже даны в `docs/review.md`, актуальны и после этого аудита** (не повторяются подробно):
- Вынести `accounting-cache-freshness.ts`, `money.ts`, `float-percent.ts`,
  `period-calculation.orchestrator.ts` в `src/shared/domain/` — п. 2 и 4 review.md.
- Решить вопрос авторизации HTTP API — п. 6 review.md.

## Ограничения метода

Граф построен AST-экстракцией TypeScript-импортов/вызовов (`EXTRACTED`, высокая точность) +
LLM-инференс семантических связей (`INFERRED`, ниже точность, отмечено отдельно). 47 `.sql`-файлов
не проанализированы (нет зависимости `tree_sitter_sql`). Связи `imports`/`imports_from` в части
случаев дублируют друг друга (два ребра на один реальный импорт из-за особенностей экстрактора) —
цифры в этом документе считают их отдельно, поэтому реальное число уникальных связей может быть на
10-20% ниже количества edges; относительные пропорции между парами модулей от этого не меняются.
Анализ ограничен `backend/src`, `frontend/` не проверялся.
