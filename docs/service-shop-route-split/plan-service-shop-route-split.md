# Plan: Разделение backend-роутов по направлениям `/service` и `/shop`

**PRD** docs/service-shop-route-split/prd-service-shop-route-split.md
**Дата** 2026-08-12

## Фазы реализации

### Фаза 1: Версия и префикс направления там, где логика уже не общая (tracer bullet)

**Цель** Провести паттерн `/v1/{service|shop}/...` через все эндпоинты, которые сегодня физически
привязаны только к одному направлению (или уже лежат под правильным доменом) и не требуют разделения
общего кода — минимальный сквозной путь, доказывающий подход на всём проекте перед более сложными
фазами.

**Что затрагивает?** backend

**Задачи:**
- [ ] `backend/src/config/app.routes.ts`: ввести `serviceRoot`/`shopRoot` и версию `v1` во все
      корневые константы, которые сегодня без версии или без домена (`motivationSchemaRoot`,
      `shopAccountingRoot`, `shopWarehouseRoot`; добавить корни для `salary_role_types`,
      `task_completions`, `employee_hours`, `period`, ранее заданных литералами в контроллерах).
- [ ] Перенести `POST /v1/motivation-schema` → `POST /v1/service/motivation-schema`.
- [ ] Перенести `GET /accounting/salary_role_types`, `/accounting/task_completions*`,
      `/accounting/employee_hours*` → `/v1/service/accounting/...` (без изменения логики хендлеров,
      только `@Controller`/путь).
- [ ] Перенести уже существующие `/shop/accounting/*` (salary_role_types, motivation-schema,
      task_completions) и `/shop/warehouse/catalog` → `/v1/shop/accounting/*` и
      `/v1/shop/warehouse/catalog` (добавление `/v1`, домен уже верный).
- [ ] `ENDPOINTS.md`: обновить пути этих эндпоинтов.

**Когда готово** `curl`/Swagger подтверждает, что все перечисленные эндпоинты отвечают по новым путям
с `/v1/{service|shop}/...`, старые пути возвращают 404. E2E-тесты `shop-accounting`-модуля
(`domains/shop/modules/accounting/**/*.e2e.spec.ts`, если есть) и юнит-тесты соответствующих
контроллеров зелёные с новыми путями.

---

### Фаза 2: Разделение `SalesPlan`/`SalesPlanTemplate` CRUD

**Цель** `/v1/service/sales/plan*` и новый `/v1/shop/sales/plan*` — независимые эндпоинты без
`direction` в запросе клиента, с защитой операций по id от применения к строке чужого направления.

**Что затрагивает?** backend

**Задачи:**
- [ ] `contracts/commands/sales-plan.ts`: убрать `direction` из запросных схем (`createSalesPlanItemSchema`,
      `putSalesPlanTemplateRequestSchema`, `listSalesPlanTemplatesQuerySchema`,
      `listSalesPlansQuerySchema`, `approveSalesPlanRequestSchema`), пересобрать пакет.
- [ ] `domains/service/modules/sales`: перенести 7 контроллеров на `/v1/service/sales/plan*` и
      `/v1/service/sales/plan_template`, подставлять `direction: 'service'` на сервере вместо приёма
      от клиента.
- [ ] `domains/shop/modules/sales`: 7 новых контроллеров/DTO на `/v1/shop/sales/plan*` и
      `/v1/shop/sales/plan_template`, переиспользующие существующие команды/сервисы
      `domains/service/modules/sales/application` (по прецеденту `ShopSalesModule`), подставляющие
      `direction: 'shop'`; зарегистрировать в `ShopSalesModule` (`imports: [CqrsModule]`, новые
      провайдеры/контроллеры).
- [ ] Защита по направлению: добавить `direction` в `UpdateSalesPlanCommand`/`DeleteSalesPlanCommand`
      (обязательное поле) и проверку `plan.direction === command.direction` в хендлерах; в
      `ApproveSalesPlanHandler.resolveTargets` (ветка `ids`) — проверка направления всех найденных
      строк.
- [ ] `domains/service/CLAUDE.md`/`domains/shop/CLAUDE.md`: обновить абзацы о едином CRUD плана
      продаж (решение Фазы 11).

**Когда готово** `POST /v1/service/sales/plan` и `POST /v1/shop/sales/plan` создают строки только
своего направления; `PATCH`/`DELETE`/`approve` с id чужого направления возвращают "не найдено".
Юнит-тесты `create/update/delete/approve-sales-plan.handler.spec.ts` дополнены кейсами на
несовпадение направления; `sales-plan.e2e.spec.ts` обновлён под новые пути и зелёный.

---

### Фаза 3: Разделение расчётного периода accounting

**Цель** `/v1/service/accounting/period/*` и `/v1/shop/accounting/period/*` — независимые эндпоинты
без `:direction` в пути; закрытие периода одного направления не задевает другое, без кросс-доменного
импорта `domains/service → domains/shop`.

**Что затрагивает?** backend

**Задачи:**
- [ ] `get`/`reopen`/`recalculate`: убрать `:direction` из пути в сервисных контроллерах
      (`/v1/service/accounting/period/:period...`), удалить `parseAccountingDirection`.
- [ ] Новые shop-контроллеры `/v1/shop/accounting/period/:period(/reopen|recalculate)` и
      `GET /v1/shop/accounting/period/:period` в `ShopAccountingModule`, переиспользующие
      `GetAccountingPeriodService`/`ReopenAccountingPeriodHandler`/`RecalculateAccountingPeriodHandler`
      с захардкоженным `direction: 'shop'`.
- [ ] `close`: разбить `CloseAccountingPeriodHandler` на `CloseServiceAccountingPeriodHandler`
      (остаётся в `domains/service`, только сервисные зависимости) и новый
      `CloseShopAccountingPeriodHandler` (`domains/shop/modules/accounting`, только shop-зависимости);
      две отдельные команды на `/v1/service/accounting/period/:period/close` и
      `/v1/shop/accounting/period/:period/close`.
- [ ] Убрать кросс-доменный импорт `domains/shop/modules/accounting/*` из
      `domains/service/modules/accounting` (после переноса `closeShopDirection`), обновить
      комментарий в `accounting.module.ts` про "единственную точку связи".
- [ ] `close-accounting-period.direction-independence.spec.ts`: адаптировать под два независимых
      хендлера, сохранив проверку "закрытие одного направления не трогает другое".

**Когда готово** Закрытие периода `service` за месяц не создаёт/не меняет запись `AccountingPeriod`
направления `shop` за тот же месяц (и наоборот) — подтверждено регресс-тестом. `get`/`reopen`/
`recalculate` работают по новым путям без `:direction`. `grep` по `domains/service/modules/accounting`
не находит импортов из `domains/shop`.

---

### Фаза 4: Разделение отчёта по зарплате

**Цель** `/v1/service/accounting/salary_report/*` и `/v1/shop/accounting/salary_report/*` —
независимые эндпоинты, каждый отдаёт отчёт только своего направления, без `grandTotal` и без
кросс-доменного импорта.

**Что затрагивает?** backend

**Задачи:**
- [ ] `contracts/commands/salary-rule.ts`: новые односторонние схемы ответа на базе
      `directionSalaryReportSchema` для employee- и department-отчёта (без `directions[]`/`grandTotal`),
      удалить старые комбинированные схемы.
- [ ] `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService`: оставить только
      сервисный срез (`buildOpenServiceDirection`), убрать инъекции shop-классов и
      `ShopAccountingModule` из импортов `accounting.module.ts` (если больше нигде не нужен).
- [ ] Новые `GetShopEmployeeSalaryReportService`/`GetShopDepartmentSalaryReportService`
      (`domains/shop/modules/accounting/application/services/`) — тело текущего
      `buildOpenShopDirection`-пути, зарегистрировать в `ShopAccountingModule`.
- [ ] Контроллеры: сервисные — на `/v1/service/accounting/salary_report/employee|department/:id/:period`;
      новые shop — на `/v1/shop/accounting/salary_report/employee|department/:id/:period`.
- [ ] `get-employee-salary-report.service.spec.ts`/`get-department-salary-report.service.spec.ts`:
      разделить на сервисные и shop-тесты под новые классы.

**Когда готово** `GET /v1/service/.../salary_report/employee/:id/:period` возвращает только
сервисный срез (без `directions[]`/`grandTotal`), `GET /v1/shop/...` — только shop-срез; юнит-тесты
обоих направлений зелёные независимо друг от друга.

---

### Фаза 5: Финальная сверка и документация

**Цель** Вся карта роутов задокументирована, ни один переписанный эндпоинт не остался без `/v1`,
устаревшие формулировки Фазы 11 в CLAUDE.md убраны.

**Что затрагивает?** backend

**Задачи:**
- [ ] `ENDPOINTS.md`: полностью переписать секции `domains/service/modules/accounting`,
      `domains/service/modules/sales`, `domains/shop/modules/sales`, `domains/shop/modules/accounting`
      под итоговую карту роутов.
- [ ] Сквозной аудит: `grep` по `@Controller(` в `domains/service` и `domains/shop` — подтвердить,
      что каждый путь начинается с `v1/service` или `v1/shop` (кроме явно вынесенных в "не в скоупе"
      PRD).
- [ ] `backend/src/domains/service/CLAUDE.md` и `backend/src/domains/shop/CLAUDE.md`: убедиться, что
      не осталось упоминаний единого CRUD плана продаж на оба направления (решение Фазы 11) — при
      необходимости доправить формулировки, оставшиеся после Фаз 2–4.

**Когда готово** Все критерии готовности PRD выполнены; `npm run build`/`npm run lint`/`npm run test`
в `backend/` проходят целиком; ручной прогон Swagger показывает только `/v1/service/*` и `/v1/shop/*`
среди переписанных эндпоинтов.