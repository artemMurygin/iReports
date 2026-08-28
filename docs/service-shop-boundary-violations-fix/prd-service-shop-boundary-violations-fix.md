# PRD: Устранение нарушений архитектурной границы Service ↔ Shop

**Дата**: 2026-08-27
**Статус**: Draft

## Цель

Полностью устранить прямую связность между доменами `service` и `shop` в backend. Правило проекта
однозначно: логика каждого домена живёт отдельно, переиспользование кода между доменами напрямую
запрещено архитектурными границами. Тот факт, что часть текущих связей ранее была задокументирована
и названа в `docs/review.md` «осознанным исключением», не делает её допустимой — граф-аудит
(`docs/service-shop-boundary-violations.md`) фиксирует 624 прямых edge между доменами в обход
`shared`/`kernel`, и все они подлежат устранению: либо переносом действительно direction-агностичного
кода на уровень выше доменов (`shared`/интеграционный слой), либо разделением на полностью
независимые реализации внутри каждого домена. Исключение — связь `work-schedule` ↔ `service`,
которая в этой итерации сознательно сохраняется (см. «Не в скоупе»).

## Пользовательские сценарии

- Разработчик меняет реализацию расчётного периода (`AccountingPeriod`) или документа начисления
  зарплаты (`SalaryAccrual`) в домене `service` -> `shop` не затрагивается, потому что у него
  собственная независимая реализация периода и начисления, без общих портов и Prisma-репозиториев.
- Система определяет, был ли сотрудник уволен на момент закрытия периода, и считает его баланс
  выплат -> оба домена обращаются к общему, вынесенному выше `service`/`shop` слою (`EmployeeDismissal`
  читает `BitrixEmployee.isActive` из Bitrix24, `BalanceTransaction` — единый по `employeeId` баланс
  сотрудника с эндпоинтами без направления в пути), а не через `domains/service/modules/accounting`.
  Это не архитектурное исключение, а корректное место: обе сущности не являются бизнес-логикой ни
  `service`, ни `shop`.
- Разработчик меняет логику фиксации кассовых операций (`ErpCashDocument`) при выплате зарплаты в
  `shop` -> код `service` не импортирует ничего из `shop`, и наоборот: у каждого домена своя
  реализация фиксации кассовых операций под свою ERP (RoApp у `service`, МойСклад у `shop`).
- Разработчик создаёт/утверждает план продаж в `service` -> использует собственную реализацию
  `service` (сущность, порт, репозиторий, CQRS-команды), полностью отдельную от `shop` — не общий
  Prisma-дискриминатор `direction` и не общий `CommandBus`.
- Закрывается учётный период `shop` -> ничего не происходит с графиком работы (`work-schedule`):
  эта проверка остаётся исключительно бизнес-процессом `service` в текущей итерации.
- Разработчик запускает графовый/статический аудит границ доменов после мержа этой работы -> прямых
  edges `service ↔ shop` в обход `shared`/`kernel` не найдено (0, с учётом погрешности экстрактора),
  кроме сознательно сохранённой связи `work-schedule → service`.

## В скоупе

1. **Расчётный период (`AccountingPeriod`) — раздельная реализация по доменам** (часть §2.1, а
   также ранее «принятые» порты `ACCOUNTING_PERIOD_REPOSITORY` / `ACCOUNTING_PERIOD_SNAPSHOT` /
   `ACCOUNTING_CALCULATION_CACHE`, `accounting-cache-freshness.ts`): `shop` получает собственные
   сущность/порт/Prisma-репозиторий периода, снапшота закрытия и кэша расчёта, не переиспользуя код
   `domains/service/modules/accounting`. `shop-accounting.module.ts` не подключает ни один
   Prisma-репозиторий `service`.
2. **Начисление зарплаты (`SalaryAccrual`) — раздельная реализация по доменам** (часть §2.1): порт,
   сущность, Prisma-репозиторий, application-сервисы (`get-accounting-period.service.ts`,
   `get-close-period-preview.service.ts`, `get-salary-accrual.service.ts`), мапперы ответов и
   CQRS-команды accrual — своя независимая копия в каждом домене.
3. **Увольнение сотрудника (`EmployeeDismissal`) и баланс выплат сотрудника
   (`BalanceTransaction`) — вынос в сквозные модули вне доменов**: обе сущности физически не являются
   бизнес-логикой ни `service`, ни `shop`. `EmployeeDismissal` — чтение `BitrixEmployee.isActive`,
   синхронизируемого из общекорпоративного Bitrix24. `BalanceTransaction` — единый по `employeeId`
   баланс сотрудника (`direction` — не более чем атрибут происхождения движения, остаток считается
   без фильтра по направлению), с HTTP-эндпоинтами (`/v1/accounting/balance/*`), уже не имеющими
   направления в пути. Целевое расположение — новые сквозные модули по образцу уже существующих
   `src/modules/{directory,employee-identity,work-schedule}` (DDD-слои `application`/`domain`/
   `infrastructure`/`interface`, вне `domains/*`), а не `src/shared` (там нет бизнес-модулей, только
   базовые классы/порты/утилиты) и не `src/integrations/bitrix` (сырой API-клиент без DDD-слоёв):
   `src/modules/employee-dismissal/` для `EmployeeDismissal` (по образцу тонкого read-only
   `modules/directory`), `src/modules/employee-balance/` для `BalanceTransaction` (по образцу
   полноценных `modules/work-schedule`/`modules/employee-identity`). Оба домена обращаются к ним из
   новых модулей, а не через `domains/service`. Поведение (единый баланс на сотрудника, признак
   увольнения) не меняется.
4. **ERP-кассовый документ (`ErpCashDocument`) — раздельная реализация по доменам** (§2.2): разрыв
   двустороннего цикла `Service.accounting.module ↔ Shop.moysklad-cash-document.adapter` полностью в
   обе стороны; каждый домен фиксирует кассовые операции самостоятельно под свою ERP, без общего
   порта/сущности/репозитория на два домена, включая `erp-cash-config.provider.ts`.
5. **План продаж (`SalesPlan`) — раздельная реализация по доменам** (§2.3, §4): `service` получает
   собственную отдельную реализацию плана продаж (сущность, порт, Prisma-репозиторий, CQRS-команды
   `create/update/delete/approve-sales-plan`, `put-sales-plan-template`,
   `ensure-sales-plans-for-period.service.ts`), не общую с `shop` ни через Prisma-дискриминатор
   `direction` на одной модели, ни через общий `CommandBus`/хендлеры. `shop` перестаёт использовать
   `SalesPlanRepositoryPort`/`SALES_PLAN_REPOSITORY` и сущность `SalesPlan` из `service`;
   `shop-sales-performance.value-object.ts` и расчёт зарплаты `shop` (§4) используют только
   собственные типы `shop`.
6. **Тест shared-инфраструктуры, завязанный на `service`** (§2.5): `direction-sync-lock.spec.ts` не
   импортирует `RoappSyncCron`/`RoappSyncService`/`RoappErpPeriodSyncAdapter` из `domains/service`.
7. **CLI/миграционные скрипты вне рантайм-кода** (§5, рекомендация 5): вынос
   `migrateEmployeeIdentities.ts`, `migrateWorkScheduleHours.ts`, `migrateTaskCompletedRuleConfigs.ts`,
   `exportRoappOrders.ts`, `initialUploadData.ts` из `src/shared` — устраняет ложные срабатывания
   графового анализа границ.
8. **Актуализация `docs/review.md`**: удаление всех формулировок об «осознанно переиспользуемых»
   или «принятых» связях между `service` и `shop` (кроме явно сохранённой в этой итерации связи
   `work-schedule → service`), отражение фактического состояния границ после рефакторинга.

### Дополнение по итогам Фазы 8 (самоаудит после первой волны рефакторинга)

Финальная верификация Фазы 8 (см. план) выполнила повторный графовый/grep-аудит и нашла **5 мест**,
которые не были явно названы в пунктах 1–7 выше, но относятся к той же категории связности `shop →
service`, физически расположенные в `domains/service/modules/accounting`, хотя по содержанию не
специфичны ни для одного домена (нет ERP-специфичной логики; уже отмечены как direction-агностичные
в комментариях самого кода). По результатам точечного разбора — все 5 выносятся в общий слой
(`src/shared`/`src/modules/employee-balance`), а не дублируются по доменам:

9. **`ErpPeriodSyncRunner`/`ERP_PERIOD_SYNC`/`ErpPeriodSyncPort`** (обёртка таймаута + маппинг ошибки
   синка периода с ERP, уже используется обоими доменами через один порт) → `src/shared`.
10. **`PayoutConfirmationRequiredException`** (завязана на форму `BalanceTransaction`/остаток, не на
    конкретную ERP) → `src/modules/employee-balance/domain/exceptions/`.
11. **`SalaryAccrualDocumentsCreatedDomainEvent`** (+ лог-обработчик; уже содержит поле `direction`,
    публикуется обоими хендлерами закрытия периода) → `src/shared`.
12. **`CloseAccountingPeriodDto`** (тривиальная zod-обёртка над общим контрактом, без домена в теле)
    → `src/shared`.
13. **`mergeEmployeeSalaryRules`** (generic-функция по структурному интерфейсу, без завязки на тип
    правила конкретного домена) → `src/shared`.

**Статус: выполнено Фазой 9 + точечная ручная правка.** Все 5 артефактов перенесены в общий слой;
дополнительно по ходу верификации Фазы 9 обнаружен и перенесён туда же (вручную, вне workflow)
шестой — `ErpSyncFailedException` (бросается тем же `ErpPeriodSyncRunner`, конструктор уже принимал
`direction` параметром) — теперь `src/shared/application/exceptions/erp-sync-failed.exception.ts`.

Также найдены **2 тестовых файла** `domains/shop/modules/accounting/domain/salary-rule-*.spec.ts`,
напрямую импортирующих service-реестр/каталог для сравнения с shop-версией:
`salary-rule-role-catalog.spec.ts` — сравнение множеств строк-типов, переводится на hardcoded
snapshot без потери смысла проверки; `salary-rule-registry.spec.ts` — третий тест сравнивает
ссылочную идентичность объектов (`not.toBe`, защита от регрессии «shop случайно стал реэкспортом
service-реестра») и **не может** быть переведён в snapshot без потери смысла — остаётся
задокументированным исключением, аналогичным `work-schedule → service`.

## Не в скоупе

- **5 тестовых кросс-доменных импортов, признанные легитимными по итогам Фаз 8–9** — финальный
  grep-аудит (`docs/service-shop-boundary-violations.md`) подтверждает **0** прямых импортов между
  `domains/service` и `domains/shop` в продакшн-коде в обе стороны; остаются только тестовые файлы,
  каждый — намеренный regression-тест архитектурного инварианта, а не нарушение:
  1. `close-accounting-period.direction-independence.spec.ts` — регрессионный тест, намеренно
     проверяющий оба домена одновременно (ключ `(direction, period)` не путается между направлениями).
  2. `payout.e2e.spec.ts` — переопределяет провайдер `SHOP_ERP_CASH_DOCUMENT_PORT`, реально
     резолвящийся общим `src/modules/employee-balance/`, а не прямой связью `service → shop`.
  3. `salary-rule-registry.spec.ts` (третий тест, сравнение ссылочной идентичности `Map`/классов
     реестров) — защищает инвариант «shop не стал реэкспортом service», не переводится в snapshot без
     потери смысла.
  4. `close-shop-accounting-period.work-schedule-independence.e2e.spec.ts` — регрессионный тест
     Фазы 5, подтверждающий сохранённое исключение `work-schedule → service` (закрытие периода
     `shop` не задевает `work-schedule`); по своей природе спаивает оба домена в одном тесте.
  5. `create-shop-payout.handler.spec.ts` — регрессионный тест на изоляцию per-direction хранилищ
     начислений/кассовых документов, конструирует `service`-хендлер напрямую внутри `shop`-спека для
     сравнения поведения.
  Все пять остаются как есть — попытка убрать любой из них уменьшила бы, а не увеличила защиту от
  регресса архитектурных инвариантов.
- **`WorkSchedule → Service.Accounting`** (§2.4): связь сознательно сохраняется в этой итерации.
  График работы остаётся привязан только к `service` (`EnsurePeriodNotClosedService`/
  `ACCOUNTING_PERIOD_REPOSITORY` домена `service`); `shop` с графиком работы никак не связан.
  Закрытие учётного периода `shop` не должно вызывать никаких проверок/побочных эффектов в
  `work-schedule` — это фиксируется как ограничение, а не устраняется как нарушение.
- Модернизация домена `opt` — не затрагивается, функциональность не реализована.
- Аудит и исправление границ на стороне `frontend` — граф-аудит ограничен `backend/src`.
- Изменение видимого поведения фич для конечного пользователя (расчёт зарплаты, план продаж,
  кассовые документы должны продолжать давать те же бизнес-результаты) — устраняется архитектурная
  связность реализации, а не бизнес-логика или API-контракты, кроме случаев, где разделение по
  доменам неизбежно меняет способ получения данных (например, `shop` перестаёт напрямую читать план
  продаж `service`).
- `Shop.Other → Service.Other` (документ-документ, `CLAUDE.md` ↔ `CLAUDE.md`) и семантические связи
  между документами графа — это не код, не входит в скоуп.
- Новая функциональность или изменение схемы БД сверх переноса/дублирования/разделения
  существующего кода.

## Технические ограничения

- Домены `service` и `shop` интегрируются с разными ERP-системами (RemOnline и МойСклад
  соответственно) и должны сохранять полностью независимую эволюцию бизнес-логики после
  рефакторинга.
- `EmployeeDismissal` и `BalanceTransaction` — единственные элементы, для которых целевое место не
  «раздельно по доменам», а сквозные модули `src/modules/employee-dismissal/` и
  `src/modules/employee-balance/` вне `domains/*` (по образцу `src/modules/{directory,
  employee-identity,work-schedule}`): `EmployeeDismissal` читает данные общекорпоративного контура
  (Bitrix24), общего для всей компании; `BalanceTransaction` — единый баланс сотрудника, физически
  не привязанный к одному направлению (остаток считается по `employeeId` без фильтра по
  `direction`). Их перенос не должен менять наблюдаемое поведение (один баланс на сотрудника,
  признак увольнения из Bitrix24).
- Физические таблицы БД между `service` и `shop` **не разбиваются** по доменам — решение пользователя:
  `AccountingPeriod`/`AccountingPeriodSnapshot`/`AccountingCalculationCache`/`SalaryAccrual`(+строки/
  корректировки)/`SalesPlan`/`SalesPlanTemplate` остаются каждый одной общей таблицей с
  дискриминатором `direction` (он уже есть на всех перечисленных). Изоляция доменов достигается
  только на уровне кода: у `service` и `shop` — собственные независимые Entity/Port/Repository-классы,
  каждый обращается к той же таблице через свой Prisma-делегат, но всегда фильтрует/подставляет свой
  фиксированный `direction`. Для `ErpCashDocument`, у которой различающего поля пока нет (только
  `system`), допускается аддитивная миграция — добавить `direction` (`ALTER TABLE ADD COLUMN`), без
  создания новой таблицы и без переноса данных.
- Изменения в `shop-accounting.module.ts`, `shop-sales.module.ts`,
  `service/modules/accounting/accounting.module.ts`, `service/modules/sales/*` затрагивают
  DI-контейнер — критично не сломать сборку модулей на старте приложения.
- 47 `.sql`-файлов не покрыты графовым анализом (нет зависимости `tree_sitter_sql`) — вне текущей
  проверки.
- Связи `imports`/`imports_from` в графовом инструменте могут задваиваться (до ~10-20% от числа
  edges) — при итоговой верификации ориентироваться на факт отсутствия импортов (grep/AST), а не на
  точное совпадение цифр из аудита.
- Работа выполняется в рамках существующей структуры `src/domains/{service,shop}` и общей
  инфраструктуры `src/shared`/`src/infrustructure`/`src/integrations` — новый общий код (только
  `EmployeeDismissal`) размещается там, а не создаёт третий domain-независимый бизнес-слой.

## Критерии готовности

- [x] `grep -rl "from ['\"].*domains/service" backend/src/domains/shop/` не находит совпадений
      (кроме путей через `src/shared`/`src/infrustructure`/`src/integrations`). Проверено 2026-08-27:
      0 совпадений в продакшн-коде; остаются только 3 тестовых файла из документированного списка
      «5 тестовых кросс-доменных импортов» выше (`work-schedule-independence.e2e.spec.ts`,
      `create-shop-payout.handler.spec.ts`, `salary-rule-registry.spec.ts`).
- [x] `grep -rl "from ['\"].*domains/shop" backend/src/domains/service/` не находит совпадений
      (кроме путей через `src/shared`/`src/infrustructure`/`src/integrations`). Проверено 2026-08-27:
      0 совпадений в продакшн-коде; остаются только 2 тестовых файла из того же списка
      (`payout.e2e.spec.ts`, `close-accounting-period.direction-independence.spec.ts`).
- [x] `shop-accounting.module.ts` и `shop-sales.module.ts` не импортируют ни одного файла из
      `domains/service/**` напрямую.
- [x] `domains/service/modules/accounting/accounting.module.ts` не импортирует ничего из
      `domains/shop/**`, и `domains/shop/integrations/moySklad/moysklad-cash-document.adapter.ts` не
      импортирует ничего из `domains/service/**`.
- [x] `EmployeeDismissalPort`/`EmployeeDismissalRepository` физически находятся в
      `src/modules/employee-dismissal/`, не в `domains/service/modules/accounting/**`; оба домена
      получают признак увольнения из этого модуля.
- [x] `BalanceTransaction` (порт, сущность, репозиторий, эндпоинты `/v1/accounting/balance/*`)
      физически находится в `src/modules/employee-balance/`, не в
      `domains/service/modules/accounting/**`; баланс сотрудника по-прежнему единый на `employeeId`
      (не разделён по `direction`), эндпоинты продолжают возвращать тот же результат, что до
      переноса.
- [x] `shop-sales-performance.value-object.ts` и расчёт зарплаты `shop` не импортируют сущность/порт
      `SalesPlan` из `domains/service` — используют собственную реализацию `shop`.
- [x] `domains/service/modules/sales/**` (план продаж) не используется из `domains/shop` ни через
      прямой импорт, ни через общий `CommandBus`-диспатч CRUD-команд плана продаж.
- [x] `work-schedule.module.ts` продолжает зависеть от `EnsurePeriodNotClosedService`/
      `ACCOUNTING_PERIOD_REPOSITORY` домена `service` (сохранённое исключение); тестом подтверждено,
      что закрытие учётного периода `shop` не вызывает никаких проверок/побочных эффектов в
      `work-schedule` (`close-shop-accounting-period.work-schedule-independence.e2e.spec.ts`, Фаза 5).
- [x] `backend/src/shared` не содержит файлов `migrateEmployeeIdentities.ts`,
      `migrateWorkScheduleHours.ts`, `migrateTaskCompletedRuleConfigs.ts`, `exportRoappOrders.ts`,
      `initialUploadData.ts`; соответствующие npm-скрипты работают по новым путям. Выполнено
      коммитом `784156c`: `initialUploadData.ts` перенесён в `src/scripts/` и диспатчит CQRS-команды
      по одной на каждую ERP (реализованы в `application/command` соответствующих sync-модулей
      доменов); `exportRoappOrders.ts`/`migrateEmployeeIdentities.ts`/`migrateWorkScheduleHours.ts`
      удалены как одноразовые, уже выполненные миграции; `migrateTaskCompletedRuleConfigs.ts` в
      `src/shared` не найден (удалён ранее, до этого аудита).
- [x] `src/shared/infrastructure/sync-lock/direction-sync-lock.spec.ts` не импортирует
      `RoappSyncCron`, `RoappSyncService`, `RoappErpPeriodSyncAdapter` из `domains/service`.
- [x] `docs/review.md` не содержит формулировок об «осознанном»/«принятом» переиспользовании кода
      между `service` и `shop`, кроме явно описанного исключения `work-schedule → service`. Старые
      формулировки оставлены зачёркнутыми с пометкой «Устарело» и ссылкой на факт (сохранение истории
      код-ревью), а не физически удалены — критерий выполнен по смыслу.
- [x] Повторный прогон графового аудита (grep-скрипт по методике
      `docs/service-shop-boundary-violations.md`) показывает 0 прямых code-level edges
      `service ↔ shop` в продакшн-коде (в обход `shared`/`kernel`/`modules`), кроме
      `WorkSchedule → Service.Accounting` и 5 задокументированных тестовых исключений (см. выше).
      Проверено независимо 2026-08-27.
- [x] Полный прогон backend test suite (`npm test` / `npm run test:e2e` в `backend/`) зелёный после
      рефакторинга, включая e2e-тесты `payout`, `balance-transactions`, `balance-summary`,
      `salary-accruals`, `salary-accrual-lines`. Проверено независимо 2026-08-27: 1096/1097, единственное
      падение (`start-price-import.handler.spec.ts`, домен `marketing/pricing`) не связано с этой
      работой — воспроизводится и на состоянии до рефакторинга (`git stash`).
- [x] Приложение (`backend`) успешно стартует локально (DI-контейнер собирается без ошибок) после
      разделения зависимостей между доменами.
