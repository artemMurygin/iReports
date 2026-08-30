# Фаза 13.5: Отчёты и закрытие периода — подключение направления `shop`

> Рабочий план и статус реализации issue из `docs/payroll/plan-payroll-calculation.md` (строки
> 233–248). Одобрен пользователем в режиме планирования; ведётся как живой документ на время
> реализации — раздел «Статус реализации» обновляется по мере продвижения.

## Контекст

Расчётные правила магазина (Фазы 12–13, `UsedProductSold`/`TaskCompleted`/`ProductSold`/
`PayPerHour`) уже полностью считают в юнит-тестах, но не подключены к контуру, который их
использует:

- `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService` жёстко захардкожены на
  `direction = 'service'`;
- `CloseAccountingPeriodHandler` всегда строит контекст через сервисный
  `BuildServiceCalculationContextService`, даже если `command.direction === 'shop'`;
- у мотивационной схемы/правила/задачи (`TaskCompletion`) магазина нет HTTP-пути записи — создать
  их можно только напрямую в БД.

Без этой фазы Фазы 16/18 (чисто UI) упрутся в backend, которого по факту нет для `shop`. Цель —
довести направление `shop` до того же контура, что уже работает для `service`: сквозной отчёт,
закрытие периода, HTTP-запись мотивации.

## Архитектурное решение: НЕ переиспользовать доменный код между `service` и `shop`

`backend/CLAUDE.md` (домен `service`, раздел «Целевой набор модулей») прямо и авторитетно
(инструкции проекта важнее наблюдаемого кода) фиксирует:

> "`service` и `shop` — параллельные бизнес-направления... это **не общий переиспользуемый код**, а
> зеркальный, но независимый набор модулей в каждом домене (кроме моделей
> `SalesPlan`/`SalesPlanTemplate`/`TaskCompletion`, которые осознанно общие **на уровне
> Prisma-схемы** с дискриминатором `direction`... но **не на уровне доменного кода**)."

Это подтверждается уже сделанным в Фазах 12–13 выбором: `domains/shop/modules/accounting/domain/`
уже сегодня содержит **свои независимые** `money.ts`/`float-percent.ts`/
`salary-rule-role-catalog.ts`/`role-source.ts` — притом что они структурно почти идентичны
сервисным аналогам. Значит:

- **Общее** между `service` и `shop`: Prisma-таблицы (`MotivationSchema`/`SalaryRule` с
  `direction`-дискриминатором на `SalaryRule`, `TaskCompletion.direction`, generic
  `AccountingPeriod`/`AccountingPeriodSnapshot`/`AccountingCalculationCache` с ключом `(direction,
  period[, employeeId])`) и по-настоящему generic типы уровня `src/shared/domain/`
  (`CalculationContext`, `CalculationLine`).
- **НЕ общее**: доменные классы/сервисы, которые оперируют этими данными —
  `PeriodCalculationOrchestrator`, построитель разбивки правил, маппер отчётных строк, сущности
  `MotivationSchema`/`TaskCompletion`. `domains/shop/modules/accounting` получает **свои** копии
  этих файлов — структурно зеркальные, но отдельные, независимо эволюционирующие классы.

Единственная точка, где `domains/service` и `domains/shop` связаны на уровне Nest DI — композиция в
`AccountingModule` (service), который **импортирует** `ShopAccountingModule` ради DI-токенов
(портов), а не ради переиспользования классов — зеркально уже существующей зависимости
`ShopSalesModule` → сервисные `SalesPlanRepository`/`SalesPlanTemplateRepository` в другую сторону.

## Решения по открытым вопросам (согласовано с пользователем)

1. **`isClosed`** — убран с верхнего уровня ответа сотрудника, перенесён в каждый элемент
   `directions[]`. `service` и `shop` закрываются независимо, поэтому статус закрытия — свойство
   направления, а не всего отчёта.
2. **`grandTotal.prognose = Σ(direction.total.prognose ?? direction.total.fact)`** — для закрытого
   направления `prognose` не хранится (`null`), но экономически сумма уже финальна и равна `fact`;
   для открытого — берётся его реальный `prognose`. Итог — всегда осмысленное число ("сколько
   заплатить сотруднику по лучшей текущей оценке"), никогда `null`, не занижает.
   `grandTotal.fact` — простая сумма `direction.total.fact` (оба всегда числа).
3. **Отчёт по отделу** не получает `directions[]`-разбивку в этой фазе — `employees[].rules`
   объединяет строки обоих направлений в одном списке; верхнеуровневый `isClosed` отдела — `true`,
   только если оба направления периода закрыты (сознательное упрощение относительно
   employee-отчёта).

## Полный технический план

### 1. Contracts (`contracts/commands/`)

- `salary-rule.ts` — `directionSalaryReportSchema` получает `isClosed: z.boolean()`;
  `employeeSalaryReportResponseSchema` теряет `isClosed` на верхнем уровне, `grandTotal.prognose`
  становится обязательным числом (не `nullable`).
- `shop-motivation-schema.ts` (новый файл) — `ShopMotivationRequestSchema` с
  `rules: shopSalaryRuleRequestSchema[]`, по аналогии с уже существующим `shop-salary-rule.ts` (свой
  `discriminatedUnion`, не смешанный с сервисным).
- `index.ts` — `export * from './shop-motivation-schema';`.

### 2. Prisma

Миграции не требуются — `SalaryRule.direction`, `TaskCompletion.direction`,
`AccountingPeriod/AccountingCalculationCache/AccountingPeriodSnapshot.direction` уже на месте от
предыдущих фаз.

### 3. `domains/shop/modules/accounting` — новое дерево (независимая реализация)

```
domains/shop/modules/accounting/
├── domain/
│   ├── entities/
│   │   ├── motivation-schema.entity.ts
│   │   └── task-completion.entity.ts
│   ├── services/
│   │   ├── period-calculation.orchestrator.ts
│   │   └── rule-breakdown.builder.ts
│   ├── entities/salary-rules/*                       (уже есть, не трогаем)
│   ├── salary-rule-registry.ts, factories/*           (уже есть, не трогаем)
│   └── types/calculation-data.types.ts            (уже есть, не трогаем)
├── application/
│   ├── command/ (create/confirm/reject/delete task-completion, create motivation-schema/salary-rule)
│   ├── ports/ (shop-motivation-schema, shop-salary-rule, shop-task-completion, shop-calculation-data)
│   ├── mappers/to-salary-report-rules.ts
│   └── services/ (build-shop-calculation-context, get-employee-shop-salary-report, list-shop-task-completions)
├── infrastructure/
│   ├── mappers/ (shop-salary-rule, shop-motivation-schema, shop-task-completion)
│   ├── schemas/salary-rule.schema.ts
│   └── repositories/ (shop-motivation-schema, shop-salary-rule, shop-task-completion, shop-calculation-data)
└── interface/
    ├── dto/
    └── http-controllers/
```

Ключевые файлы:

- **`ShopCalculationDataPort`/`Repository`** — источники: `EmployeeIdentity` (весь список, без
  фильтра по `system`), `MoySkladDemandPosition`+`MoySkladDemand` (`productSoldItems`),
  `TaskCompletion(direction='shop')`, `EmployeeHoursEntry` (общая), `BitrixEmployee` (отдел),
  `ProductFolderTreeService.resolveDescendantFolderIds` (раскрытие категорий, переиспользуется как
  кросс-модульный, не кросс-доменный сервис).
- **`BuildShopCalculationContextService`** — центральный файл фазы, `build(period, employeeId,
  rules)` (третий параметр `rules` — расхождение с сервисной сигнатурой `build(period, employeeId)`,
  так как `categoryDescendantFolderIds` зависит от `category` конкретных правил схемы).
- **`ShopMotivationSchema`/`ShopSalaryRule`** — независимый агрегат, `ShopMotivationSchemaRepository`
  читает ту же Prisma-таблицу `motivation_schemas`/`salary_rules`, но `include: { rules: { where: {
  direction: 'shop' } } }`. Обязательный метод `findIdByTarget(targetType, targetId)` — защита от
  дублирования строки `MotivationSchema` (у неё в БД нет `direction`, ключ только
  `(targetType, targetId)`) для сотрудника с идентичностями в обеих ERP.
- **`ShopTaskCompletion`** — независимая сущность (не импорт `TaskCompletion` сервиса),
  `ShopTaskCompletionMapper.toPersistence()` пишет `direction: 'shop'`.
- HTTP DTO для `TaskCompletion` переиспользуют **контракт** (не бизнес-код) — сервисные Zod-схемы
  `createTaskCompletionRequestSchema`/`confirmTaskCompletionRequestSchema`/… уже
  direction-агностичны.
- Маршруты: `POST /shop/accounting/motivation-schema`, `POST/POST/POST/DELETE/GET
  /shop/accounting/task_completions*`.

### 4. Правки в `domains/service/modules/accounting`

- **`GetEmployeeSalaryReportService`** — убрать `private readonly direction`; добавить
  `SHOP_MOTIVATION_SCHEMA_REPOSITORY`+`BuildShopCalculationContextService`; параллельно строить
  `buildServiceDirectionReport`/`buildShopDirectionReport`, каждый со своим `isClosed`;
  `grandTotal` — по формулам из «Решений по открытым вопросам».
- **`GetDepartmentSalaryReportService`** — тот же принцип батчем на отдел, без N+1;
  `employees[].rules` объединяет оба направления.
- **`CloseAccountingPeriodHandler`** — выбор `motivationSchemaRepo`/context-builder по
  `command.direction` (`closeServiceDirection`/`closeShopDirection`), общие generic-порты
  (`periodRepo`/`snapshotRepo`/`cacheRepo`/`salesPlanRepo`) не меняются.
- **`CreateMotivationSchemaHandler`** (find-or-create, симметрично shop-версии) — перед `insert()`
  проверка `findIdByTarget`, чтобы не плодить вторую строку `MotivationSchema` на того же
  `targetId`.

### 5. Модульная сборка

- `ShopAccountingModule` — импортирует `ShopSalesModule` (даёт `SHOP_SALES_PERFORMANCE_READER`),
  собирает все новые провайдеры/контроллеры, экспортирует `SHOP_MOTIVATION_SCHEMA_REPOSITORY`,
  `BuildShopCalculationContextService`, `SHOP_CALCULATION_DATA`, `SHOP_SALES_PERFORMANCE_READER`.
- `AccountingModule` (service) — `imports: [..., ShopAccountingModule]`, чтобы `SHOP_*` токены
  резолвились в трёх direction-aware сервисах.

### 6. Роуты

Добавить в `routesV1.shopAccounting`: `motivationSchema`, `taskCompletions`, `taskCompletionById`,
`confirmTaskCompletion`, `rejectTaskCompletion`. `GET/POST /accounting/period/:direction/:period[...]`
и `GET /accounting/salary_report/{employee,department}/:id/:period` — маршруты не меняются.

### 7. Тесты

Юнит для новых shop-файлов (create-motivation-schema/salary-rule handler, build-shop-calculation
-context, мапперы); дополнение существующих сервисных тестов (`get-employee-salary-report`,
`get-department-salary-report`, `close-accounting-period.handler`,
`close-accounting-period.direction-independence`); сквозной e2e — сотрудник с идентичностями в
обеих ERP получает объединённый отчёт, одна строка `motivation_schemas` в БД, закрытие `service` не
трогает `shop`.

### 8. `ENDPOINTS.md`

Обновить формулировки про пробел «BuildShopCalculationContextService не реализован», описать новые
маршруты `/shop/accounting/motivation-schema` и `/shop/accounting/task_completions*`.

## Статус реализации

Легенда: ✅ готово · 🔄 в работе · ⬜ не начато.

| # | Задача | Статус |
|---|---|---|
| 1 | Contracts: `isClosed` в `directions[]`, `grandTotal.prognose` не `nullable`, новый `shop-motivation-schema.ts` | ✅ |
| 2 | `ShopCalculationDataPort` + `ShopCalculationDataRepository` | ✅ |
| 3 | Независимые `PeriodCalculationOrchestrator`/`rule-breakdown.builder`/`to-salary-report-rules` для shop | ✅ |
| 4 | `ShopSalaryRule` mapper/schema/repository | ✅ |
| 5 | `ShopMotivationSchema` сущность + mapper/repository + `findIdByTarget` | ✅ |
| 6 | `ShopTaskCompletion` сущность + mapper/repository | ✅ |
| 7 | `BuildShopCalculationContextService` | ✅ |
| 8 | CQRS команды мотивации/правил магазина (Create MotivationSchema/SalaryRule) | ✅ |
| 9 | CQRS `TaskCompletion` магазина (create/confirm/reject/delete/list) + контроллеры | ✅ |
| 10 | Роуты `app.routes.ts` + сборка `ShopAccountingModule` | ✅ |
| 11 | Service: find-or-create дедупликация `MotivationSchema` | ✅ |
| 12 | Service: `GetEmployeeSalaryReportService` — direction-aware | ✅ |
| 13 | Service: `GetDepartmentSalaryReportService` — direction-aware | ✅ |
| 14 | Service: `CloseAccountingPeriodHandler` — direction-aware | ✅ |
| 15 | `AccountingModule` (service): `imports: [ShopAccountingModule]` | ✅ |
| 16 | E2E: сквозной тест сотрудника в обеих ERP + shop HTTP e2e | ✅ |
| 17 | `ENDPOINTS.md` + doc-комментарии + финальная проверка (`lint`/`test`/`build`) | ✅ |

### Что уже сделано по факту (детали)

- `contracts/commands/salary-rule.ts` — `directionSalaryReportSchema` дополнен полем `isClosed:
  z.boolean()`; `employeeSalaryReportResponseSchema` лишился верхнеуровневого `isClosed`,
  `grandTotal` теперь `{ fact: number, prognose: number }` (без `nullable`). Пакет `contracts`
  собирается (`npm run build`) без ошибок.
- `contracts/commands/shop-motivation-schema.ts` — новый файл, `ShopMotivationRequestSchema`.
- `contracts/commands/index.ts` — добавлен экспорт нового файла.
- `backend/src/domains/shop/modules/accounting/application/ports/calculation-data.port.ts` —
  новый порт `ShopCalculationDataPort` + токен `SHOP_CALCULATION_DATA`.
- `backend/src/domains/shop/modules/accounting/infrastructure/repositories/
  calculation-data.repository.ts` — реализация порта (Prisma-запросы к
  `EmployeeIdentity`/`MoySkladDemandPosition`/`TaskCompletion`/`EmployeeHoursEntry`/
  `BitrixEmployee`, `resolveCategoryDescendantFolderIds` через `ProductFolderTreeService`).
- `backend/src/domains/shop/modules/accounting/domain/services/float-percent.ts` — дополнен
  `resolveFloatPercentThresholds`/`buildFloatPercentThresholdInfo` (зеркало сервисных, нужны для
  будущего `to-salary-report-rules.ts`).
- Реализация доведена до конца всеми оставшимися пунктами (4–17) многоагентным workflow: независимые
  `ShopSalaryRule`/`ShopMotivationSchema`/`ShopTaskCompletion` domain+infrastructure+application+
  interface слои, `BuildShopCalculationContextService` (+ `to-sales-performance-context.ts`/
  `to-sales-performance-summary.ts`), CQRS-запись мотивации/правил/задач магазина с HTTP-входом
  (`POST /shop/accounting/motivation-schema`, `POST|GET /shop/accounting/task_completions`,
  `POST /shop/accounting/task_completions/:id/{confirm,reject}`,
  `DELETE /shop/accounting/task_completions/:id`), `ShopAccountingModule` (импортирует
  `ShopSalesModule`, экспортирует `SHOP_MOTIVATION_SCHEMA_REPOSITORY`/
  `BuildShopCalculationContextService`/`SHOP_CALCULATION_DATA`/`SHOP_SALES_PERFORMANCE_READER`),
  find-or-create дедупликация `MotivationSchema` на сервисной стороне (`findIdByTarget`),
  direction-aware `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService`/
  `CloseAccountingPeriodHandler` + `AccountingModule.imports: [ShopAccountingModule]`, сквозной e2e
  (`shop-report-integration.e2e.spec.ts`) и обновление `ENDPOINTS.md`.
- Финальная проверка: `npm run build` (backend) и `npm run build` (`contracts`) — без ошибок;
  `npx jest --testPathPatterns="domains/(shop|service)/modules/accounting"` — 61 test suite / 292
  теста, все зелёные; `eslint` по изменённым файлам модуля `accounting` (оба домена) — 0 ошибок
  (только pre-existing warning-паттерн `no-unsafe-argument` на типе `App` в e2e-спеках, тот же, что
  уже был в `get-employee-salary-report.e2e.spec.ts` до этой фазы). Репозиторный `npm run lint`
  по-прежнему падает, но исключительно на pre-existing ошибках вне модуля `accounting`
  (`src/TODO/**`, `integrations/**`, `sync/**`, `main.ts` и т. п.) — не регрессия этой фазы.
  `npm run test:e2e` требует поднятой тестовой Postgres и не запускался в этом прогоне; тест написан
  и типизирован корректно (проходит компиляцию в составе `npm run build`).

### Порядок выполнения (фаза завершена)

Все 11 шагов исходного плана выполнены; см. таблицу «Статус реализации» выше — пункты 1–17 ✅.

## Проверка (после завершения всех шагов)

- `npm run test -- --testPathPatterns=domains/shop/modules/accounting` и
  `--testPathPatterns=domains/service/modules/accounting` — все зелёные.
- `npm run test:e2e` — включая новый сквозной сценарий «сотрудник в обеих ERP».
- `npm run build` — компиляция без ошибок.
- Ручная проверка через `npm run start:dev` + `POST /shop/accounting/motivation-schema` →
  `POST /shop/accounting/task_completions` + `confirm` → `GET
  /accounting/salary_report/employee/:id/:period` — `directions` содержит `shop` с ненулевыми
  `rules`.

### Critical files

- `backend/src/domains/shop/modules/accounting/application/services/
  build-calculation-context.service.ts` (новый)
- `backend/src/domains/shop/modules/accounting/application/ports/calculation-data.port.ts` +
  `infrastructure/repositories/calculation-data.repository.ts` (новые, готовы)
- `backend/src/domains/shop/modules/accounting/domain/entities/
  {shop-motivation-schema,shop-task-completion}.entity.ts` (новые)
- `backend/src/domains/service/modules/accounting/application/services/
  get-employee-salary-report.service.ts` — direction-aware правка
- `backend/src/domains/service/modules/accounting/application/command/
  close-accounting-period.handler.ts` — direction-aware правка
- `backend/src/domains/service/modules/accounting/application/command/
  create-motivation-schema.handler.ts` — find-or-create по target
- `backend/src/domains/shop/modules/accounting/accounting.module.ts` — точка входа DI
- `contracts/commands/shop-motivation-schema.ts` (новый, готов), `contracts/commands/salary-rule.ts`
  (правка `isClosed`, готова)
