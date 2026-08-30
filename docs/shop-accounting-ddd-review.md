# DDD-ревью: `backend/src/domains/shop/modules/accounting` — 2026-08-28

Ветка: `refactoring`. Ревью проводилось по методологии Eric Evans (Domain-Driven Design) как первый
шаг подготовки к рефакторингу модулей, в которых стало сложно ориентироваться и проводить review.
Модуль `shop/accounting` — расчёт зарплат/мотивации сотрудников магазина (шоп): motivation schemas,
salary rules, salary accruals, task completions, accounting periods, erp-cash документы. Проверялось
текущее состояние `domain/`, `application/`, `infrastructure/`, `interface/` модуля целиком (не diff).

## Итоговая оценка: 8/10

Оценка по чек-листу из фреймворка DDD (7 диагностических пунктов по 1 баллу + до 3 баллов за
глубину):

| # | Диагностический вопрос | Итог |
|---|---|---|
| 1 | Имена классов/методов понятны бизнес-эксперту (без `Manager`/`Helper`/`Processor`)? | ✅ `PayPerHour`, `ProductSold`, `MotivationSchema`, `SalaryAccrual` |
| 2 | Границы bounded context явно определены? | ✅ ноль production-импортов из `domains/service`/`domains/opt`, собственные DI-токены |
| 3 | Агрегаты небольшие (root + минимальный кластер)? | ✅ `ShopSalaryAccrual → Line → LineAdjustment`, ссылки между агрегатами по ID |
| 4 | Доменные объекты содержат поведение, а не только данные? | ✅ rich model: `accrueLine/adjustLine/markPaid`, расчётные сущности правил с логикой внутри |
| 5 | Domain events используются для декаплинга между агрегатами? | ❌ события заведены структурно правильно, но **без единого обработчика** |
| 6 | Anti-Corruption Layer на каждой внешней интеграции? | ✅ с нюансом — см. раздел «Инфраструктура» |
| 7 | Core Domain определён (лучшая глубина моделирования)? | ✅ неявно — расчётные правила получили максимум глубины |

База: 6/7 (потеря на пункте про events). Глубина: +1 за богатую модель Core Domain, +1 за
консистентный ubiquitous language, **0** за «инварианты только внутри агрегатов» — часть бизнес-правил
протекла в application-слой (см. находки №1, №3). Итого **8/10**.

---

## 1. Доменный слой (`domain/`)

### Entities vs Value Objects
Разделение в целом корректное. VO выделены там, где нужно: `ShopMotivationTarget`
(`domain/value-objects/motivation-target.value-object.ts:31`) и `ShopPeriodClosure`
(`domain/value-objects/period-closure.value-object.ts:16`) — обе неизменяемые группы полей
с собственной валидацией.

Пограничный случай: `ShopSalaryAccrualLineAdjustment`
(`domain/entities/salary-accrual-line-adjustment.entity.ts:21`) — сущность с `randomUUID`, но по
сути неизменяемый факт корректировки (`previousAmount`/`newAmount`/`comment`/`adjustedBy`), больше
похожий на VO/append-only событие в составе строки, чем на Entity с жизненным циклом.

### Aggregate boundaries
Корни явные и небольшие: `ShopAccountingPeriod`, `ShopSalaryAccrual` (root; `ShopSalaryAccrualLine`/
`ShopSalaryAccrualLineAdjustment` — внутренний кластер, доступ только через `getLine()`,
`domain/entities/salary-accrual.entity.ts:128`), `ShopMotivationSchema` (root; `rules:
ShopSalaryRule[]` — кластер правил), `ShopTaskCompletion`, `ShopErpCashConfig`, `ShopErpCashDocument`.
Ссылки между агрегатами — по id (`employeeId: number`, `ruleId: string`, `transactionId: string`), не
по объекту — граница соблюдена.

### Anemic vs rich model
Модель богатая, не data bag. `ShopSalaryAccrual` несёт бизнес-переходы
(`accrueLine/unaccrueLine/adjustLine/markPaid/revertToAccrued/recalculateStatus`,
`domain/entities/salary-accrual.entity.ts:136-203`), `ShopTaskCompletion.confirm/reject` с
guard-переходом (`domain/entities/task-completion.entity.ts:94-115`). Расчётные сущности правил
(`ProductSoldEntity.calculate`, `UsedProductSoldEntity.calculate`) содержат нетривиальную доменную
логику — matching по роли, категории, дедупликацию, fail-closed по неполному контексту — не вынесены
в сервис-«процессор». `PeriodCalculationOrchestrator`
(`domain/services/period-calculation.orchestrator.ts:17`) сознательно тонкий: только
`rule.calculate()` + сумма, никаких `switch` по типу — хороший пример Strategy без анемичности.

### Инварианты
В основном внутри агрегатов: `ShopSalaryAccrual.validate()` проверяет
`total === sum(lines.originalAmount)` (`domain/entities/salary-accrual.entity.ts:219-227`),
`ShopSalaryAccrualLine.adjust()` запрещает корректировку не-DRAFT строки. Явно задокументированные
исключения из этого правила — проверка «все строки плана продаж утверждены» и подсчёт `employeeCount`
оставлены application-слою (комментарии в `domain/entities/accounting-period.entity.ts:32-33,
72-74`) — осознанный, а не случайный вынос. Отдельно от этого — реальная утечка бизнес-правила в
`CreateShopPayoutHandler` (см. находку №1 ниже), уже не задокументированная как осознанное решение.

### Domain events
Форма правильная: past tense, immutable факты (`ShopAccountingPeriodClosedDomainEvent`,
`ShopMotivationSchemaCreatedDomainEvent`). Но реального использования нет — оба события без
обработчиков (сознательно, «вне скоупа», согласно комментариям в файлах событий) — то есть паттерн
зафиксирован структурно, но не выполняет функцию декаплинга агрегатов, для которой заводился.

### Ubiquitous language
Хорошо: `PayPerHour`, `ProductSold`, `UsedProductSold`, `TaskCompleted`, `MotivationSchema`,
`SalaryAccrual` — термины, узнаваемые бизнес-экспертом, без `Manager/Helper/Processor` в
domain-коде (кроме `PeriodCalculationOrchestrator` — приемлемое название доменного
сервиса-координатора).

### Утечка инфраструктуры в домен
Не обнаружена: нет импортов Prisma/ORM/NestJS-декораторов в `domain/`. Базовые классы
(`AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent`) — из `shared/domain`, не инфраструктура.
Единственный сомнительный момент — `domain/services/moysklad-demand-link.ts:12` строит URL конкретно
под веб-интерфейс МойСклад внутри домена (сам файл честно помечает это допущением, требующим
проверки) — не утечка ORM, но знание о внешней системе внутри домена, ближе к presentation/ACL-слою.

### `salary-rule-registry`
`domain/salary-rule-registry.ts:19` — чистый `Map<type, EntityClass>` + `ShopSalaryRuleFactory.create()`
(`domain/factories/salary-rule.factory.ts:11`) — классический Strategy+Factory registry без
DI-фреймворка внутри, изолированный от одноимённого реестра `service` (задокументированное решение
против переиспользования кода между направлениями).

---

## 2. Application-слой (`application/`)

### Толщина command handlers
В основном — тонкие оркестраторы: load repo → вызвать метод агрегата → save → map response. Пример
эталона: `AccrueShopSalaryAccrualLineHandler`
(`application/command/accrue-salary-accrual-line.handler.ts:50-65`) — находит агрегат, зовёт
`accrual.accrueLine(lineId)` (домен), сохраняет в транзакции. `AdjustShopSalaryAccrualLineHandler`
(`application/command/adjust-salary-accrual-line.handler.ts:39-46`) аналогично — вся валидация
переходов внутри `accrual.adjustLine()`. Переходы состояния (`accrueLine`, `unaccrueLine`,
`adjustLine`, `markPaid`, `close`) подтверждённо живут в сущностях.

`CloseShopAccountingPeriodHandler`
(`application/command/close-accounting-period.handler.ts:110-201`) — здесь оркестрируются 6+
шагов (проверка плана продаж, поиск периода, ERP-синк, сброс кэша дважды, расчёт снапшота,
`buildAccrualDocuments`, событие), объём и число ветвлений заметно превышает «тонкий оркестратор».
Часть последовательности (порядок сброса кэша, повторное удаление внутри транзакции, правило
«документ на каждую строку, включая нулевые и уволенных») — это доменные инварианты процесса закрытия
периода, зафиксированные только в комментариях хендлера, а не в самом домене.

### Repository/Port interfaces
Все порты лежат в `application/ports/*`, реализации — в `infrastructure/repositories/*`, что
соответствует принятому в проекте паттерну (последовательный, задокументированный в `backend/CLAUDE.md`
выбор — расхождение с классическим DDD, где порт репозитория обычно кладут в `domain/`). Имена методов
— на языке домена: `findAccruedByEmployee`, `findPaidByEmployee`, `findConfirmedByPeriod`,
`findIdByTarget`, `initializeName`, `findByDepartment` — не технические `getByStatusCode`.

### Application services vs domain services
Смешение минимально, но есть. `BuildShopCalculationContextService`
(`application/services/build-calculation-context.service.ts`) — правильная оркестрация (сбор
данных из нескольких портов, батчинг, без бизнес-калькуляций суммы); сама калькуляция вынесена в
`PeriodCalculationOrchestrator`/`rule.calculate()` (domain). Однако
`GetShopEmployeeSalaryReportService.buildClosedDirection`
(`application/services/get-employee-salary-report.service.ts:106-161`) и зеркальный кусок в
`GetShopDepartmentSalaryReportService.buildClosedContributions`
(`application/services/get-department-salary-report.service.ts:169-203`) — почти идентичный код,
реализующий эвристику «`appliedPercent` восстанавливается по наличию `salaryBasis`» (комментарий
строки 125-128) прямо в application, а не через доменный маппер/метод сущности снапшота — это
доменное правило интерпретации данных, продублированное в двух сервисах.

### CQRS-дисциплина
В целом соблюдается: команды меняют состояние и возвращают response DTO агрегата. Настоящее
смешение — `CreateShopPayoutBatchHandler`
(`application/command/create-payout-batch.handler.ts:55-124`): один «handler» читает балансы
(`sumByEmployee`), диспатчит `CreateShopPayoutCommand` через `CommandBus` в цикле и одновременно
строит агрегированный отчёт `outcomes[]` — команда, которая одновременно оркестрирует другие команды
и формирует объёмный отчётный DTO с бизнес-классификацией статусов
(`NEEDS_CONFIRMATION`/`PAID`/`FAILED`), что ближе к query/read-model поведению.

### Ubiquitous language
Расхождений не найдено — термины (`accrue`, `adjust`, `unaccrue`, `motivation schema`, `salary rule`,
`task completion`, `snapshot`) идентичны между domain/application/mappers, комментарии явно
поддерживают синхронизацию с зеркальным `service`-доменом.

### Factory usage
`ShopSalaryRuleFactory.create()` используется корректно в `CreateShopMotivationSchemaHandler`
(`application/command/create-motivation-schema.handler.ts:66-73`) для сборки правил внутри
`ShopMotivationSchema.create()`. `ShopSalaryAccrual.createFromSnapshot()` (вызывается в
`close-accounting-period.handler.ts:192-199`) — фабричный статический метод самой сущности, а не
ручная сборка полей в handler. Других мест ручной сборки сложных агрегатов в обход фабрики не найдено.

### Наибольшая утечка бизнес-логики
`CreateShopPayoutHandler` (правило подтверждения выплаты + saga-компенсация, находка №1 ниже) и
дублированная эвристика восстановления `appliedPercent` в двух report-сервисах (находка №3 ниже).

---

## 3. Infrastructure/Interface-слои и границы bounded context

### Repositories
Все проверенные (`infrastructure/repositories/salary-accrual.repository.ts`,
`motivation-schema.repository.ts` и др.) корректно реализуют соответствующие
`application/ports/*` (сигнатуры совпадают 1:1). Prisma-специфика (`where`, `include`,
`direction: 'shop'` фильтрация) полностью инкапсулирована внутри репозитория — наружу возвращаются
только доменные сущности через маппер. Пример дисциплины:
`infrastructure/repositories/motivation-schema.repository.ts:39-51` — каждый метод сопровождён
комментарием, почему нужен `include: { rules: { where: { direction: 'shop' } } }`.

### Mappers
Чистое разделение persistence/domain-model. `salary-accrual.mapper.ts` и
`erp-cash-document.mapper.ts` берут Prisma record-типы только как входной тип `toDomain()`,
наружу — доменные Entity/VO. `direction: 'shop'` жёстко проставляется в `toPersistence()`, а не
читается из записи — задокументированное решение.

### MoySklad / Anti-Corruption Layer
`infrastructure/sync/moysklad-erp-period-sync.adapter.ts` — это не ACL, а тонкий триггер: реализует
`ErpPeriodSyncPort.syncPeriod(period)`, делегируя в `MoySkladSyncService.uploadDemandsByMoment()`
(`domains/shop/sync/moySklad/`), никаких MoySklad-типов в сигнатуре/domain-слое `accounting` нет.
Собственно Anti-Corruption Layer (перевод сырых ответов МойСклад API в `moySklad*` Prisma-таблицы)
физически живёт **вне модуля `accounting`**, в `domains/shop/sync/moySklad/moysklad-sync.mappers.ts`
— отдельный upstream-слой, `accounting` читает уже нормализованные локальные Prisma-таблицы через
свои репозитории. Архитектурно это допустимо (модуль `accounting` не общается с МойСклад напрямую), но
означает, что собственного ACL внутри `modules/accounting/infrastructure/sync/` нет — только один
тонкий адаптер-триггер.

### HTTP-контроллеры и DTO
Все проверенные контроллеры (`close-shop-accounting-period`, `create-shop-payout`,
`get-shop-employee-salary-report`, `create-shop-motivation-schema`, `accrue-shop-salary-accrual-line`)
— тонкие: `@Body()`/`@Param()` → `Command`/`CommandBus`/сервис, без бизнес-логики. Пограничное место —
`interface/http-controllers/get-employee-salary-report.http.controller.ts:29-34` — парсинг `id`
в `Number` + `ArgumentInvalidException` при не-integer — тривиальная валидация типа параметра роута,
не бизнес-правило. DTO — обёртки `createZodDto()` над схемами из `ireports-contracts`, дублирования
доменных типов не найдено.

### Границы bounded context
`grep -rn "domains/service" .` в модуле дал ~150 совпадений, но все production-совпадения —
комментарии («Зеркало domains/service/…», WHY-объяснения независимости). Единственные реальные
`import`-строки из `domains/service` найдены только в тестовых файлах:
- `application/command/create-payout.handler.spec.ts:16-21` — импортирует
  `InMemoryErpCashDocumentRepository`, `CreatePayoutHandler` и т.п. из `domains/service` (для
  сравнительного/изолирующего теста).
- `interface/http-controllers/close-accounting-period.work-schedule-independence.e2e.spec.ts:16`
  — импортирует `EnsurePeriodNotClosedService` из `domains/service` (тест на независимость расписаний
  между направлениями).
- `domain/salary-rule-registry.spec.ts:6` — импортирует `salaryRuleRegistry` из `domains/service`
  (тест на изоляцию реестра правил).

`grep -rn "domains/opt"` — 0 совпадений. `grep -rn "from '@prisma" domain/"` — 0 совпадений
(domain-слой не знает о Prisma). Production-код полностью изолирован от `domains/service` и
`domains/opt`; связь есть только в тестах, и все три случая выглядят намеренными
(сравнительные/independence-тесты). `accounting.module.ts` не импортирует ни `AccountingModule`
из `service`, ни его классы — заводит собственные DI-токены под теми же именами
(`SHOP_ACCOUNTING_PERIOD_REPOSITORY` и т.д.).

### Сравнение с `service/modules/accounting`
Структура и ubiquitous language согласованы почти зеркально (близкое число файлов: application 74/71,
domain 38/37, interface 40/40). Расхождения:
- **`application/events/` отсутствует в shop** — у `service` есть
  `AccountingPeriodClosedEventHandler`/`MotivationSchemaCreatedEventHandler`; в `shop` их нет.
  Проверено — это намеренно (комментарий в `accounting-period-closed.domain-event.ts`: «без
  временного лог-хендлера… задача формирования salaryReport по этому событию вне скоупа»), не
  регрессия.
- **Отсутствие unit-тестов для 7 command-хендлеров shop**, у которых есть тесты в `service`:
  `accrue-period-salary-accruals.handler.ts`, `accrue-salary-accrual-document.handler.ts`,
  `accrue-salary-accrual-line.handler.ts`, `adjust-salary-accrual-line.handler.ts`,
  `recalculate-accounting-period.handler.ts`, `reopen-accounting-period.handler.ts`,
  `unaccrue-salary-accrual-line.handler.ts` — все соответствующие `service`-хендлеры покрыты
  `.spec.ts`. Частично компенсируется e2e (`salary-accruals.e2e.spec.ts` покрывает
  close→accruals→reopen), но точечные unit-тесты (edge-cases, исключения) для этих хендлеров в `shop`
  отсутствуют — реальный пробел тестового покрытия, а не архитектурная проблема слоёв.
- В `service` есть дублирующая опечатка-директория `domain/exceptions` и `domain/exeptions` (реальный
  баг именования в `service`) — в `shop` такой опечатки нет.

Архитектурных регрессий уровня infrastructure/interface или bounded-context в `shop`-версии не
обнаружено.

---

## Сильные стороны

- Явные небольшие агрегаты, ссылки между ними по ID, богатая модель расчётных правил (Core Domain
  получил максимум глубины моделирования).
- Инварианты по большей части внутри агрегатов, чистый ubiquitous language без техножаргона.
- Домен полностью чист от инфраструктуры — ни Prisma, ни NestJS-декораторов персистентности в
  `domain/`.
- Репозитории 1:1 реализуют порты, мапперы честно разделяют persistence/domain-модель.
- Контроллеры тонкие, DTO — обёртки над Zod-схемами из `contracts`, без дублирования доменных типов.
- Реестр правил (`salary-rule-registry.ts` + `ShopSalaryRuleFactory`) — чистый Strategy/Factory,
  изолированный от одноимённого в `service`.
- Границы bounded context с `service`/`opt` не нарушены ни разу в production-коде.

## Находки, требующие внимания (по убыванию значимости)

1. **Бизнес-правило + saga-логика в handler вместо домена.**
   `application/command/create-payout.handler.ts:82-193` — вычисление `balanceAfter`, условие
   `needsConfirmation` и компенсирующий откат ERP-документа при сбое БД зашиты прямо в CQRS-хендлере.
   Это доменное правило («выплата требует подтверждения при недостаточном остатке»), место которому —
   в агрегате или доменном сервисе.

2. **Domain events не выполняют свою функцию.** Оба события в `domain/events/` структурно корректны
   (past tense, immutable), но обработчиков нет — задача явно оставлена «вне скоупа» в комментариях.
   Пока это мёртвый паттерн, а не работающий механизм декаплинга.

3. **Дублированная доменная эвристика в двух application-сервисах.**
   `application/services/get-employee-salary-report.service.ts:106-161` и
   `application/services/get-department-salary-report.service.ts:169-203` содержат почти
   идентичный код восстановления `appliedPercent` по наличию `salaryBasis` — правило интерпретации
   данных, продублированное вместо вынесения в доменный маппер/метод.

4. **`CloseShopAccountingPeriodHandler` перегружен оркестрацией**
   (`application/command/close-accounting-period.handler.ts:110-201`, ~90 строк, 6+ шагов).
   Формально не нарушает границы домена (все мутации — через методы сущностей), но инварианты
   процесса закрытия периода (порядок сброса кэша, «документ на каждую строку, включая нулевые»)
   зафиксированы только в комментариях хендлера.

5. **Минорное:** `ShopSalaryAccrualLineAdjustment`
   (`domain/entities/salary-accrual-line-adjustment.entity.ts:21`) смоделирован как Entity, хотя
   по сути immutable-факт корректировки — ближе к Value Object.

6. **Минорное:** `domain/services/moysklad-demand-link.ts:12` строит URL под конкретный веб-интерфейс
   МойСклад прямо в домене — небольшая утечка знания о внешней системе (сам файл это признаёт
   комментарием).

7. **Не архитектурное, но заметное:** 7 command-хендлеров (`accrue-period-shop-salary-accruals`,
   `accrue-shop-salary-accrual-document/line`, `adjust-shop-salary-accrual-line`,
   `recalculate/reopen-shop-accounting-period`, `unaccrue-shop-salary-accrual-line`) не имеют
   unit-тестов, хотя их зеркала в `service/modules/accounting` покрыты. Частично компенсируется e2e.

---

## Методология

Ревью проведено тремя параллельными агентами (доменный слой; application-слой; infrastructure +
границы bounded context) с последующей синтезирующей оценкой по чек-листу навыка
`domain-driven-design` (Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of
Software*). Каждый агент читал полное содержимое ключевых файлов слоя (не только листинг), выполнял
целевой grep для проверки утечек инфраструктуры и границ контекста, сверял репозитории/порты 1:1 и
сравнивал модуль с зеркальным `domains/service/modules/accounting`.
