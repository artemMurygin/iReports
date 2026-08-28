# Plan: Устранение нарушений архитектурной границы Service ↔ Shop

**PRD** [prd-service-shop-boundary-violations-fix.md](./prd-service-shop-boundary-violations-fix.md)
**Дата** 2026-08-27

## Фазы реализации

### Фаза 1: Инфраструктурная чистка
**Цель** Убрать изолированные, не требующие миграции данных нарушения — снижает шум графового аудита
перед основной работой и служит tracer bullet: подтверждает, что сборка/тесты/npm-скрипты остаются
зелёными на протяжении всего рефакторинга.
**Что затрагивает?** backend
**Задачи:**
- [x] Перенести `migrateEmployeeIdentities.ts`, `migrateWorkScheduleHours.ts`,
      `migrateTaskCompletedRuleConfigs.ts`, `exportRoappOrders.ts`, `initialUploadData.ts` из
      `src/shared` в новую `scripts/`-директорию вне рантайм-кода; обновить пути в npm-скриптах
      `package.json` (`npm run initial`, `npm run export:roapp-orders`,
      `npm run migrate:employee-identities` и т.п.) — выполнено коммитом `784156c`
      (`src/scripts/initialUploadData.ts`, диспатч CQRS-команд по ERP; устаревшие
      миграционные скрипты удалены)
- [ ] Заменить прямой импорт `RoappSyncCron`/`RoappSyncService`/`RoappErpPeriodSyncAdapter` из
      `domains/service` в `src/shared/infrastructure/sync-lock/direction-sync-lock.spec.ts` на
      мок/фейк, не завязанный на конкретную ERP-интеграцию
- [ ] Прогнать `npm run build` и полный `npm test` — подтвердить, что перенос ничего не сломал
**Когда готово** npm-скрипты миграций работают по новым путям; `direction-sync-lock.spec.ts` не
импортирует ничего из `domains/service`; `npm run build` и `npm test` зелёные.

### Фаза 2: Вынос EmployeeDismissal выше доменов
**Цель** Убрать чтение признака увольнения сотрудника из `domains/service/modules/accounting` — это
не бизнес-логика ни `service`, ни `shop`, а чтение общекорпоративных данных Bitrix24
(`BitrixEmployee.isActive`).
**Что затрагивает?** backend
**Задачи:**
- [ ] Создать сквозной модуль `src/modules/employee-dismissal/` (по образцу `src/modules/directory`)
      и перенести туда `EmployeeDismissalPort` (`application/ports/employee-dismissal.port.ts`) и
      `EmployeeDismissalRepository` (`infrastructure/repositories/employee-dismissal.repository.ts`)
      из `domains/service/modules/accounting`, сохранив сигнатуру `findDismissedEmployeeIds`
- [ ] Обновить `accounting.module.ts` (service) и `shop-accounting.module.ts` — импорт токена
      `EMPLOYEE_DISMISSAL` из нового расположения вместо `domains/service`
- [ ] Обновить все точки использования (`close-accounting-period.handler.ts`,
      `get-close-period-preview.service.ts`, `get-balance-summary.service.ts`,
      `close-accounting-period.direction-independence.spec.ts`, e2e-тесты payout/
      balance-transactions/balance-summary/salary-accruals) на новый путь импорта
- [ ] Прогнать полный `npm test`/`npm run test:e2e`
**Когда готово** `EmployeeDismissalPort`/`EmployeeDismissalRepository` физически находятся в
`src/modules/employee-dismissal/`, не в `domains/service/modules/accounting/**`; оба домена
получают признак увольнения из этого модуля; тесты зелёные.

### Фаза 3: Вынос BalanceTransaction выше доменов
**Цель** Баланс сотрудника физически единый (`SUM(amount)` по `employeeId`, без фильтра по
`direction`), с эндпоинтами уже без направления в пути — вынос устраняет связность через
`domains/service` и разрывает направление Service→Shop двустороннего цикла ERP-кассового документа
(§2.2 аудита).
**Что затрагивает?** backend
**Задачи:**
- [ ] Создать сквозной модуль `src/modules/employee-balance/` (по образцу `src/modules/
      work-schedule`/`src/modules/employee-identity`, DDD-слои `domain`/`application`/
      `infrastructure`/`interface`) и перенести туда `BalanceTransactionPort`/сущность/репозиторий
      (`application/ports/balance-transaction.port.ts`, `domain/entities/
      balance-transaction.entity.ts`, `infrastructure/repositories/balance-transaction.repository.ts`)
      и маппер (`to-balance-transaction-response.ts`) из `domains/service/modules/accounting`
- [ ] Перенести туда же `create-balance-transaction.handler.ts`/`delete-balance-transaction.handler.ts`
      (с командами), `get-balance-summary.service.ts` и HTTP-контроллеры `/v1/accounting/balance/*`;
      новый модуль инжектит оба уже существующих доменных порта
      (`SERVICE_ERP_CASH_DOCUMENT_PORT`, `SHOP_ERP_CASH_DOCUMENT_PORT` — они остаются определены в
      своих доменах) и выбирает нужный по `direction` транзакции
- [ ] Обновить `domains/service/modules/accounting/accounting.module.ts` — убрать импорт
      `MoyskladModule`/`MoyskladCashDocumentAdapter`/`SHOP_ERP_CASH_DOCUMENT_PORT` из `domains/shop`
      (wiring теперь в `src/modules/employee-balance/`); убрать провайдер `BALANCE_TRANSACTION_REPOSITORY` из
      `shop-accounting.module.ts`
- [ ] Обновить e2e-тесты `balance-transactions`, `balance-summary`, `payout` на новые пути импорта
- [ ] Прогнать полный `npm test`/`npm run test:e2e` и проверить старт приложения
      (`npm run start:dev` до `Nest application successfully started`)
**Когда готово** `accounting.module.ts` (service) не импортирует `MoyskladModule`/
`MoyskladCashDocumentAdapter`/`SHOP_ERP_CASH_DOCUMENT_PORT`; баланс сотрудника остаётся единым
(`/v1/accounting/balance/*` даёт тот же результат, что до переноса); e2e-тесты balance-transactions/
balance-summary/payout зелёные.

### Фаза 4: Раздельная реализация ErpCashDocument/ErpCashConfig по доменам
**Цель** Разорвать оставшееся (Shop→Service) направление цикла §2.2 — локальный дедуп-репозиторий
кассового документа и провайдер конфигурации кассы дублируются по доменам вместо переиспользования
класса из `domains/service`.
**Что затрагивает?** backend, database
**Задачи:**
- [ ] Продублировать `ErpCashConfig` (entity/port/`ErpCashConfigProvider`) и `ErpCashDocument`
      (entity/port/репозиторий) из `domains/service/modules/accounting` в
      `domains/shop/modules/accounting` как независимые классы под собственными токенами; таблица
      `erp_cash_documents` остаётся одна общая (без разбивки по доменам) — добавить ей колонку
      `direction` аддитивной миграцией (сейчас различающее поле только `system`), оба новых
      репозитория читают/пишут в ту же таблицу через тот же Prisma-делегат, каждый со своим
      фиксированным `direction`
- [ ] Обновить `domains/shop/integrations/moySklad/moysklad-cash-document.adapter.ts` — заменить
      импорты `ERP_CASH_CONFIG_REPOSITORY`/`ErpCashConfigRepositoryPort`/
      `ERP_CASH_DOCUMENT_REPOSITORY`/`ErpCashDocumentRepositoryPort` из `domains/service` на новые
      токены из `domains/shop`
- [ ] Обновить `shop-accounting.module.ts` — заменить провайдеры `ErpCashConfigProvider`/
      `ErpCashDocumentRepository` из `domains/service` на собственные из `domains/shop`
- [ ] Обновить общий модуль баланса (из Фазы 3) — резолвить конфиг/дедуп-репозиторий по каждому
      ERP-адаптеру отдельно (service-репозиторий для `SERVICE_ERP_CASH_DOCUMENT_PORT`,
      shop-репозиторий для `SHOP_ERP_CASH_DOCUMENT_PORT`)
- [ ] Прогнать Prisma-миграции и полный `npm test`/`npm run test:e2e` (включая payout/
      balance-transactions/balance-summary)
**Когда готово** `grep` по `domains/shop` не находит импортов `ErpCashConfig`/`ErpCashDocument` из
`domains/service` и наоборот; выплата в обоих доменах создаёт корректный кассовый документ в своей
ERP; тесты зелёные.

### Фаза 5: Раздельная реализация AccountingPeriod/Snapshot/CalculationCache
**Цель** Крупнейший источник связности (414 edges в §2.1 аудита) — расчётный период, снапшот
закрытия и кэш расчёта дублируются по доменам; `shop-accounting.module.ts` перестаёт подключать
Prisma-репозитории `service`.
**Что затрагивает?** backend, database
**Задачи:**
- [ ] Продублировать `AccountingPeriod` (entity/port/репозиторий), `AccountingPeriodSnapshot`
      (port/репозиторий), `AccountingCalculationCache` (port/репозиторий) и
      `accounting-cache-freshness.ts` из `domains/service/modules/accounting` в
      `domains/shop/modules/accounting` как независимые классы под собственными токенами; таблицы
      остаются общими (без разбивки по доменам) — они уже партиционированы полем `direction`,
      миграция схемы не требуется, оба новых класса обращаются к тем же таблицам через тот же
      Prisma-делегат с разным фиксированным `direction`
- [ ] Обновить `shop-accounting.module.ts` — заменить провайдеры `ACCOUNTING_PERIOD_REPOSITORY`/
      `ACCOUNTING_PERIOD_SNAPSHOT`/`ACCOUNTING_CALCULATION_CACHE` и сервисы
      `GetAccountingPeriodService`/`GetClosePeriodPreviewService`/`CalculateShopSnapshotRowsService`
      на собственные независимые классы `domains/shop` вместо переиспользуемых из `domains/service`
- [ ] Продублировать маппер `to-accounting-period-response.ts` — собственная копия для `shop`
- [ ] Добавить регрессионный тест: закрытие учётного периода `shop` не вызывает
      `EnsurePeriodNotClosedService`/`ACCOUNTING_PERIOD_REPOSITORY` модуля `work-schedule`
      (подтверждает сохранённое исключение «work-schedule привязан только к `service`»)
- [ ] Прогнать Prisma-миграции и полный `npm test`/`npm run test:e2e`
**Когда готово** `shop-accounting.module.ts` не импортирует ни одного класса из
`domains/service/modules/accounting` для периода/снапшота/кэша; `work-schedule` по-прежнему зависит
только от `service`-реализации периода и не завязан на `shop`; тесты зелёные.

### Фаза 6: Раздельная реализация SalaryAccrual
**Цель** Документ начисления зарплаты (строки, корректировки) — последний крупный кусок §2.1,
дублируется по доменам вместе с зависимыми application-сервисами, мапперами и CQRS-командами
accrual.
**Что затрагивает?** backend, database
**Задачи:**
- [ ] Продублировать `SalaryAccrual`/`SalaryAccrualLine`/`SalaryAccrualLineAdjustment` (entity/port/
      репозиторий/мапперы) из `domains/service/modules/accounting` в `domains/shop/modules/accounting`
      как независимые классы; таблицы остаются общими (без разбивки по доменам) — уже
      партиционированы полем `direction`, миграция схемы не требуется
- [ ] Продублировать application-сервисы `get-accounting-period.service.ts` (в части accrual),
      `get-close-period-preview.service.ts`, `get-salary-accrual.service.ts`,
      `list-salary-accruals.service.ts` — собственные независимые копии для `shop`
- [ ] Продублировать CQRS-команды accrual (`accrue-period-salary-accruals`,
      `accrue-salary-accrual-document/line`, `adjust-salary-accrual-line`,
      `unaccrue-salary-accrual-line`, `reopen/recalculate-accounting-period`) как собственные
      shop-хендлеры; обновить HTTP-контроллеры `accrue/adjust/recalculate/reopen/unaccrue-shop-*` на
      диспатч новых shop-команд вместо команд `service` через общий `CommandBus`
- [ ] Обновить `close-accounting-period.handler.ts` (service) и
      `close-shop-accounting-period.handler.ts` — каждый работает только со своими
      `SalaryAccrual`/`AccountingPeriod` классами
- [ ] Прогнать Prisma-миграции и полный `npm test`/`npm run test:e2e` (включая e2e
      salary-accruals/salary-accrual-lines)
**Когда готово** `grep` не находит импортов `SalaryAccrual*`/CQRS-команд accrual из `domains/service`
внутри `domains/shop`; независимые CQRS-хендлеры зарегистрированы в обоих доменах; e2e зелёные.

### Фаза 7: Раздельная реализация SalesPlan/SalesPlanTemplate
**Цель** Закрывает §2.3 и §4 аудита: `service` получает собственную отдельную реализацию плана
продаж, `shop` перестаёт использовать сущность/CommandBus `service`;
`shop-sales-performance.value-object.ts` и расчёт зарплаты `shop` используют только свои типы.
**Что затрагивает?** backend, database
**Задачи:**
- [ ] Выделить `SalesPlan`/`SalesPlanTemplate` (entity/port/репозиторий/мапперы) в
      `domains/service/modules/sales` как service-специфичную реализацию, и завести отдельную,
      независимую копию в `domains/shop/modules/sales` (не тот же класс под тем же токеном);
      таблицы остаются общими (без разбивки по доменам) — уже партиционированы полем `direction`,
      миграция схемы не требуется
- [ ] Продублировать CQRS-команды CRUD плана продаж (`create/update/delete/approve-sales-plan`,
      `put-sales-plan-template`) и `EnsureSalesPlansForPeriodService` — собственные для `shop`,
      зарегистрированные в `ShopSalesModule`; обновить HTTP-контроллеры `shop` на диспатч новых
      команд вместо команд `service` через общий `CommandBus`
- [ ] Обновить `shop-sales-performance.value-object.ts` и расчёт зарплаты `shop`
      (`build-shop-calculation-context.service.ts`, `close-shop-accounting-period.handler.ts`,
      `get-shop-department/employee-salary-report.service.ts`) — использовать собственный `SalesPlan`
      `shop` вместо `SalesPlanRepositoryPort`/`SALES_PLAN_REPOSITORY` из `service`
- [ ] Обновить `shop-sales.module.ts` и `shop-accounting.module.ts` — убрать провайдеры
      `SALES_PLAN_REPOSITORY`/`SALES_PLAN_TEMPLATE_REPOSITORY` из `domains/service`
- [ ] Прогнать Prisma-миграции и полный `npm test`/`npm run test:e2e` (включая e2e
      shop-sales-plan/shop-sales-performance)
**Когда готово** `domains/shop` не импортирует сущность/порты/команды `SalesPlan` из
`domains/service`; `shop-sales-performance.value-object.ts` и расчёт зарплаты `shop` проходят тесты
на собственных данных; тесты зелёные.

### Фаза 8: Финальная верификация и актуализация документации
**Цель** Подтвердить нулевую прямую связность `service ↔ shop` (кроме сохранённого исключения
`work-schedule → service`) и синхронизировать документацию с фактическим состоянием кода.
**Что затрагивает?** backend
**Задачи:**
- [ ] Обновить `docs/review.md` — убрать формулировки об «осознанном»/«принятом» переиспользовании
      кода между `service` и `shop`, кроме исключения `work-schedule → service`
- [ ] Повторно прогнать grep/графовый аудит по методике `docs/service-shop-boundary-violations.md`
      по всему `backend/src` — зафиксировать результат
- [ ] Полный прогон `npm test` и `npm run test:e2e`
- [ ] Проверить старт приложения локально (`npm run start:dev` до
      `Nest application successfully started`)
**Когда готово** Все критерии готовности PRD выполнены; повторный аудит показывает 0 прямых edges
`service ↔ shop` в обход `shared`/`kernel`, кроме `WorkSchedule → Service.Accounting`; тесты и
сборка зелёные.

### Фаза 9: Вынос остаточных direction-агностичных артефактов в общий слой
**Цель** Самоаудит Фазы 8 нашёл 5 мест, оставшихся физически в `domains/service/modules/accounting`
и импортируемых из `shop`, хотя по содержанию они не специфичны ни для одного домена — закрыть
разрыв между фактическим состоянием и заявленным в PRD «0 прямых edges service↔shop» (см. PRD,
раздел «Дополнение по итогам Фазы 8»).
**Что затрагивает?** backend
**Задачи:**
- [ ] Перенести `ErpPeriodSyncRunner`+`ERP_PERIOD_SYNC`/`ErpPeriodSyncPort` (сейчас
      `domains/service/modules/accounting/application/{services/erp-period-sync-runner.service.ts,
      ports/erp-period-sync.port.ts}`) в `src/shared`; обновить `accounting.module.ts` (service) и
      `shop-accounting.module.ts` на импорт из нового расположения
- [ ] Перенести `PayoutConfirmationRequiredException`
      (`domains/service/modules/accounting/domain/exceptions/salary-payout.exception.ts`) в
      `src/modules/employee-balance/domain/exceptions/`; обновить все точки использования в обоих
      доменах
- [ ] Перенести `SalaryAccrualDocumentsCreatedDomainEvent` (+ лог-обработчик) и
      `CloseAccountingPeriodDto` в `src/shared`; обновить `close-accounting-period.handler.ts`
      (service), `close-shop-accounting-period.handler.ts`,
      `close-shop-accounting-period.http.controller.ts` и все зависимые тесты
- [ ] Перенести `mergeEmployeeSalaryRules`
      (`domains/service/modules/accounting/domain/services/employee-salary-rules.ts`) в `src/shared`;
      обновить `resolve-shop-employee-salary-rules.service.ts` и service-аналог
- [ ] Перевести `salary-rule-role-catalog.spec.ts` на hardcoded snapshot вместо живого импорта
      service-каталога (сохранив проверку "shop-типы не пересекаются с service-типами");
      `salary-rule-registry.spec.ts` оставить как задокументированное исключение (см. PRD). Прогнать
      Prisma-генерацию (миграций не требуется), повторный grep-аудит по методике
      `docs/service-shop-boundary-violations.md`, `npm run build`, полный `npm test`
**Когда готово** Grep `from ['"].*domains/service" backend/src/domains/shop/` (вне
`shared/infrustructure/integrations/modules`) не находит совпадений, кроме 3 задокументированных
тестовых исключений (см. PRD, «Не в скоупе»); `npm run build` и `npm test` зелёные (кроме уже
известного, не связанного с этой работой падения `start-price-import.handler.spec.ts`).

## Правила разбивки на фазы

- Каждая фаза даёт рабочий результат и не ломает сборку/тесты.
- Фазы независимы: можно остановиться после любой, оставшиеся связи документируются как известный
  остаток, а не как поломка.
- Фаза 1 — минимальный рабочий путь (tracer bullet): без миграций данных, подтверждает, что процесс
  сборки/тестов/npm-скриптов переживает рефакторинг.
- Фазы 2–3 (вынос выше доменов) идут раньше фаз 4–7 (раздельная реализация по доменам), так как
  устраняют самую рискованную форму связности (двусторонний цикл, общий баланс) с наименьшим объёмом
  изменений.
- Фазы 4–7 идут в порядке возрастания зависимости бизнес-процесса закрытия периода: касса → период →
  начисление → план продаж.
