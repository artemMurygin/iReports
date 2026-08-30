# Код-ревью backend — 2026-08-13

Ветка: `feat/todo-modules-ddd-refactoring`. Проверялось текущее состояние `backend/src` целиком
(не diff), после слияния треков deals/reports/pricing в DDD-структуру `src/domains/{service,shop}`.

> **Актуализация 2026-08-27**: раздел «2. Кросс-импорты и нарушения границ» и связанные с ним
> формулировки в «Резюме»/«Сильные стороны»/«4. Дублирование кода» ниже описывали состояние кода на
> 13.08 и называли переиспользование `AccountingPeriod`/`accounting-cache-freshness.ts`/`SalesPlan`/
> CRUD-диспатча плана продаж между `service` и `shop` «осознанным, задокументированным исключением».
> Граф-аудит (`docs/service-shop-boundary-violations.md`, 2026-08-27) показал, что фактический
> периметр связности был кратно шире задокументированного (624 прямых edge, включая необъявленные
> ранее `SalaryAccrual`/`BalanceTransaction`/`ErpCashDocument`/`EmployeeDismissal` и обратные импорты
> `service ← shop`) — то есть это было не устойчивое архитектурное решение, а неконтролируемый дрейф.
> По итогам PRD/плана `docs/service-shop-boundary-violations-fix/` весь этот периметр устранён:
> `service` и `shop` получили полностью независимые реализации `AccountingPeriod`/
> `AccountingPeriodSnapshot`/`AccountingCalculationCache`/`SalaryAccrual`/`SalesPlan`/
> `SalesPlanTemplate`/`ErpCashConfig`/`ErpCashDocument` (свой Entity/Port/Repository-класс на домен,
> общая только физическая таблица через `direction`), CRUD плана продаж `shop` больше не диспатчит
> команды `service` через общий `CommandBus` — это собственные CQRS-хендлеры. `EmployeeDismissal` и
> `BalanceTransaction` перестали быть «одолженными у `service`» и переехали в сквозные модули вне
> доменов (`src/modules/employee-dismissal/`, `src/modules/employee-balance/`) — оба домена обращаются
> к ним оттуда. Раздел ниже оставлен как было для истории (не переписан целиком), но формулировки об
> «осознанном»/«принятом» переиспользовании между `service` и `shop` **больше не действуют** — единственное
> оставшееся сознательно сохранённое исключение такого рода в проекте — `WorkSchedule → Service.Accounting`
> (сквозной модуль `work-schedule` зависит от `EnsurePeriodNotClosedService`/`ACCOUNTING_PERIOD_REPOSITORY`
> домена `service`, `shop` с графиком работы не связан вовсе, см. PRD выше, раздел «Не в скоупе»). Полный
> актуальный список остаточных находок (несколько узких мест — общий `ErpPeriodSyncRunner`, отдельные
> доменные исключения/события/DTO, всё ещё не продублированные) — в отчёте финальной верификации Фазы 8
> того же плана, не в этом файле.

## Резюме

Рефакторинг в целом состоялся: `modules/accounting` и `modules/sales` в обоих доменах
последовательно следуют заявленной слоистости `domain → application → infrastructure → interface`,
`domain` нигде не подтягивает `application`/`infrastructure`, контроллеры нигде не инжектят
Prisma или репозитории напрямую, CQRS для команд используется единообразно. ~~Пересечение `shop` →
`service` (переиспользование `AccountingPeriod`/`SalesPlan`) — задокументированное, осознанное
исключение, а не архитектурный дрейф.~~ **Устарело, см. актуализацию выше**: это пересечение было
кратно шире, чем описано здесь, и с тех пор устранено рефакторингом границы `service`/`shop` —
единственное осознанно сохранённое исключение подобного рода теперь — `work-schedule → service`.
Проблемы кодовой базы лежат не в «нарушении границ модулей», а
в трёх других плоскостях: (1) почти полное отсутствие авторизации на HTTP-уровне для всего API, кроме
одного сквозного модуля; (2) несколько конкретных багов в синхронизации ERP и в расчёте зарплаты,
один из которых (п. 5.1) означает, что зарплатные отчёты `service` тихо считаются по устаревшим
исходным данным; (3) систематическое дублирование «чистой» расчётной логики (money/float-percent/
orchestrator) между `service` и `shop`, вопреки декларируемому DRY-принципу для денежных расчётов —
даже там, где сам код признаёт дублирование в комментариях (после рефакторинга границы `service`/`shop`
это дублирование не устранено — вынос в `shared` не входил в скоуп этой работы, см. актуализацию выше).
Дисциплина типов и Swagger-документации
высокая, `any` почти не встречается, деньги хранятся как целые рубли в Prisma. Тестовое покрытie
(134 spec-файла на 509 файлов кода, 13 e2e) сосредоточено в `accounting`/`sales` — синки и часть
интеграций проверены слабее, что и объясняет, почему часть найденных багов не поймана тестами.

## Сильные стороны

- Слоистость `domain/application/infrastructure/interface` в `accounting` и `sales` обоих доменов
  выдержана строго: направленный грепом поиск импортов `domain` → `application|infrastructure|interface`
  не дал ни одного совпадения.
- Контроллеры нигде не инжектят `PrismaService`/`*_REPOSITORY`/`*_PORT` напрямую — везде тонкий слой
  поверх application-сервисов/`CommandBus`, как того требует `backend/CLAUDE.md`.
- ~~Пересечение доменов `shop`→`service` (`accounting.module.ts`, `sales.module.ts`) — не
  забытая связность, а осознанно задокументированное (обширные комментарии со ссылками на фазы/issue)
  повторное использование `AccountingPeriod`/`SalesPlan` как direction-агностичных классов;
  обратных импортов `service`→`shop` не найдено вообще — связность однонаправленная.~~ **Устарело**:
  граф-аудит `docs/service-shop-boundary-violations.md` (2026-08-27) показал обратные импорты
  `service ← shop` (8 файлов) и периметр переиспользования кратно шире задекларированного здесь.
  После рефакторинга границы `service`/`shop` `accounting.module.ts`/`sales.module.ts` не
  подключают Prisma-репозитории `AccountingPeriod`/`SalaryAccrual`/`SalesPlan`/`ErpCashDocument`
  домена `service` — у `shop` собственные независимые классы.
- Денежные суммы согласованно хранятся как целые рубли (`Int` в Prisma, без копеек) и округляются
  единой функцией `roundRubles()` (`Math.round`) во всех процентных расчётах — решение осознанно
  задокументировано в `domain/services/money.ts` в обоих доменах.
- `any` почти не встречается (8 вхождений на весь `src`, все — в обоснованных местах общих
  утилит/интерфейсов), `forwardRef` (обычно маркер циклических зависимостей DI) не используется ни
  разу.
- CQRS применяется последовательно: все мутации идут через `CommandBus`/`@CommandHandler`; чтения
  сознательно не проходят через `QueryBus` (решение явно закомментировано) — не половинчатое
  внедрение паттерна, а осознанный выбор.
- Транзакционность закрытия/переоткрытия расчётного периода реализована корректно: `unitOfWork.run()`
  оборачивает `periodRepo.save` + `snapshotRepo.saveAll` + `cacheRepo.deleteByDirectionAndPeriod`
  одной Prisma-транзакцией через `AsyncLocalStorage` — частичных коммитов при сбое на середине нет.
- Swagger-документация (`@ApiTags`/`@ApiOperation`) присутствует на 100% контроллеров внутри
  `domains/*/modules/*` и `src/modules/*` — единственные исключения (`bitrix.controller.ts`,
  `roapp.controller.ts`, `custom-api-roapp.controller.ts`) физически лежат в `integrations/*` и
  осознанно не подключены к `/docs/*` (см. `swagger.config.ts`).

## 1. Архитектурные нестыковки

- **[Минор]** `backend/src/app.module.ts:56-58` — комментарий `TODO: не мигрировано... SalaryModule`
  ссылается на модуль, которого физически больше не существует (`src/TODO` удалён целиком, файла
  `salary.module.ts` в репозитории нет). Аналогично `backend/src/domains/service/CLAUDE.md`
  (раздел «Функциональность домена, ещё не перенесённая») описывает эндпоинты `/salary-rules/*` и
  `/salaryReport*`, которых нет в актуальном `ENDPOINTS.md`. Документация и комментарии разошлись с
  фактическим состоянием кода — для нового разработчика это выглядит как незакрытый TODO, хотя по
  факту либо функциональность уже не существует, либо реализована по-другому. **Фикс**: убрать
  мёртвую ссылку на `SalaryModule` из `app.module.ts` и обновить/убрать соответствующий раздел
  `domains/service/CLAUDE.md`.
- **[Минор]** `backend/src/domains/service/sync/roapp/roapp-sync.service.ts` (531 строк) и
  `backend/src/domains/shop/sync/moySklad/moysklad-sync.service.ts` (469 строк) объединяют в одном
  классе HTTP-оркестрацию пагинации, ERP→Prisma маппинг (частично инлайново, например
  `uploadDemand` в moysklad-версии — маппинг позиций отгрузки на 90+ строк внутри одного метода) и
  транзакционную запись. Не god object в смысле смешения непересекающихся ответственностей (каждый
  `upload*`-метод самодостаточен), но оба явно превысили комфортный размер файла из-за 10+
  почти идентичных по структуре методов (`log.start()/for await/Promise.all/log.tick/catch→rethrow`).
  **Фикс**: вынести общий шаблон постраничной загрузки в `runPagedUpload(label, generator, upsertFn)`
  под `src/shared/sync/` — заодно закрывает часть находок п. 5 (continue-on-error, троттлинг).
- **Не найдено**: остатков старой (пре-DDD) структуры конкурирующих с `src/domains/**` за одну и ту
  же предметную область не обнаружено — `src/TODO` удалён полностью, `backend/deprecated` отсутствует,
  `src/modules/employee-identity` и `src/sync/bitrix` — намеренно сквозные модули вне `domains/*` (не
  дублируют domain-логику), что соответствует `backend/CLAUDE.md`.

## 2. Кросс-импорты и нарушения границ

> **Устарело (актуализация 2026-08-27)**: все три пункта ниже описывают состояние на 13.08 и
> называют находки «осознанными исключениями». Граф-аудит `docs/service-shop-boundary-violations.md`
> показал, что реальный периметр был кратно шире (624 edge, включая необъявленные здесь
> `SalaryAccrual`/`BalanceTransaction`/`ErpCashDocument`/`EmployeeDismissal`/обратные импорты
> `service ← shop`), и это не было устойчивым осознанным решением. По плану
> `docs/service-shop-boundary-violations-fix/` весь периметр ниже устранён: `accounting-cache-freshness.ts`
> продублирован как собственный `domains/shop/modules/accounting/domain/services/accounting-cache-freshness.ts`
> (не вынесен в `shared` — решение пользователя: у каждого домена своя копия direction-специфичной
> логики, не общий переиспользуемый класс); `ACCOUNTING_PERIOD_REPOSITORY`/`ACCOUNTING_PERIOD_SNAPSHOT`/
> `ACCOUNTING_CALCULATION_CACHE` в `accounting.module.ts` теперь резолвятся в собственные классы
> `ShopAccountingPeriod`/`ShopAccountingPeriodSnapshot`/`ShopAccountingCalculationCache`, не в классы
> `domains/service`; `sales-performance.value-object.ts` больше не импортирует сущность `SalesPlan`
> `service` — использует собственную `ShopSalesPlan`. Единственное сохранённое исключение такого рода в
> проекте — `WorkSchedule → Service.Accounting` (см. PRD `docs/service-shop-boundary-violations-fix/`,
> раздел «Не в скоупе»). Небольшой остаточный периметр (общий `ErpPeriodSyncRunner`/`ERP_PERIOD_SYNC`,
> несколько доменных исключений/событий/DTO `service`, всё ещё импортируемых из `shop`) остался вне
> исходного скоупа PRD и зафиксирован в отчёте финальной верификации Фазы 8 того же плана — не был
> частью явного списка «В скоупе» и не переоткрывается здесь заново.

- **[Важно, устарело]** `backend/src/domains/shop/modules/accounting/domain/services/` не существует как
  самостоятельная реализация для *freshness*-логики кэша: `accounting-cache-freshness.ts` физически
  лежит только в `domains/service/modules/accounting/domain/services/` и напрямую импортируется из
  `shop` в трёх местах — `get-employee-salary-report.service.ts:14-18`,
  `get-department-salary-report.service.ts:12-16`,
  `close-accounting-period.handler.ts:20`. Это чистая доменная логика (сборка строки свежести
  из трёх штампов инвалидации) без ERP-специфики — по собственному правилу проекта («домен не
  зависит от чужого домена») ей место в `src/shared/domain/`, а не физически внутри `domains/service`.
  Аналогично `ACCOUNTING_PERIOD_REPOSITORY`/`ACCOUNTING_PERIOD_SNAPSHOT`/`ACCOUNTING_CALCULATION_CACHE`
  порты и их Prisma-реализации объявлены в `domains/service/modules/accounting/{application/ports,
  infrastructure/repositories}` и переиспользуются `accounting.module.ts:93-108` как generic
  инфраструктура — решение задокументировано и обосновано в комментариях модуля, но с архитектурной
  точки зрения корректнее физически вынести в `src/shared`, а не оставлять «одолженным» из чужого
  домена. **Фикс**: перенести `accounting-cache-freshness.ts` и порты/Prisma-реализации периода/кэша/
  снапшота в `src/shared/domain` и `src/shared/infrastructure` соответственно, обновить импорты в
  обоих доменах.
- **[Важно, устарело]** `backend/src/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object.ts:2`
  импортирует `SalesPlan` — доменную сущность `service` — напрямую в доменный слой `shop`
  (`import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity'`).
  Это осознанное и явно прокомментированное исключение (`SalesPlan`/`SalesPlanTemplate` общие на
  уровне Prisma-схемы через `direction`), но по букве собственного правила проекта («переиспользуется
  только Prisma-модель + CRUD-хендлеры через общий CommandBus», см. `domains/service/CLAUDE.md`)
  прямой импорт доменной сущности одного домена в доменный слой другого — более сильная связность,
  чем декларируется. Риска на практике нет (исключение зафиксировано и стабильно), отмечается для
  полноты картины.
- **Не найдено (устарело)**: ~~обратных импортов `service` ← `shop` нет ни одного (грепом
  `from ['"].*domains/shop` внутри `domains/service` — пусто) — связность между доменами строго
  однонаправленная.~~ Это утверждение оказалось неверным уже на момент граф-аудита 2026-08-27 (8 файлов
  с обратными импортами `service ← shop`, появившихся вместе с фичей `ErpCashDocument`) — см.
  `docs/service-shop-boundary-violations.md`, раздел «⚠️ Главное расхождение с `docs/review.md`».
  Импортов `domains/*` внутрь `src/shared`/`src/infrustructure` (инвертированная
  зависимость инфраструктуры от домена) не найдено, за одним легитимным исключением: скрипт
  `src/shared/initialUploadData.ts` (не часть runtime-приложения, CLI-утилита `npm run initial`)
  импортирует sync-сервисы обоих доменов — это ожидаемо для точки входа скрипта, а не архитектурная
  утечка (скрипт с тех пор перенесён из `src/shared` в `src/scripts/`, см. PRD
  `docs/service-shop-boundary-violations-fix/`, критерий готовности про CLI-скрипты). Циклических
  зависимостей (`forwardRef`) не найдено.

## 3. God objects

Строгих god objects (смешение нескольких неродственных ответственностей в одном классе) не найдено —
самые крупные файлы модуля `accounting` декомпозированы по одной сущности/сервису на файл. Однако
есть кандидаты на разделение по количеству зависимостей и размеру:

- **[Минор]** `GetDepartmentSalaryReportService`
  (`backend/src/domains/service/modules/accounting/application/services/get-department-salary-report.service.ts`,
  348 строк) и зеркальный `GetShopDepartmentSalaryReportService`
  (`backend/src/domains/shop/modules/accounting/application/services/get-department-salary-report.service.ts`,
  461 строк) — по 8 внедрённых зависимостей через `@Inject` каждый (`*_CALCULATION_DATA`,
  `*_MOTIVATION_SCHEMA_REPOSITORY`, `*_SALES_PERFORMANCE_READER`, `ACCOUNTING_PERIOD_REPOSITORY`,
  `ACCOUNTING_PERIOD_SNAPSHOT`, `ACCOUNTING_CALCULATION_CACHE`, `DOMAIN_SYNC_STATUS`,
  `SALES_PLAN_REPOSITORY`). Каждая зависимость обоснована комментарием (три источника инвалидации
  кэша, источник плана продаж и т.д.), поэтому это не случайное разрастание, а следствие бизнес-
  требования «ленивый кэш с тремя штампами свежести» — но 8 зависимостей на один сервис уже на
  границе того, что стоит держать в одном классе. **Рекомендация**: выделить сборку freshness-штампа
  (3 из 8 зависимостей: `ACCOUNTING_PERIOD_SNAPSHOT`/`ACCOUNTING_CALCULATION_CACHE`/
  `DOMAIN_SYNC_STATUS`+`SALES_PLAN_REPOSITORY`) в отдельный `AccountingCacheFreshnessService`,
  инжектируемый одной зависимостью вместо четырёх.
- **[Минор]** `roapp-sync.service.ts`/`moysklad-sync.service.ts` — см. п. 1 (10+ методов с почти
  идентичной структурой в одном классе, а не смешение ответственностей).

## 4. Дублирование кода

Раздел построен на прямом сравнении `service`/`shop`-версий модулей `accounting`/`sales`.
`backend/CLAUDE.md`/`domains/*/CLAUDE.md` декларируют политику «зеркальные, но независимые модули».
~~С двумя явными исключениями (`SalesPlan`/`SalesPlanTemplate`/`TaskCompletion` через `direction` и
CRUD плана продаж).~~ **Устарело (актуализация 2026-08-27)**: после рефакторинга границы `service`/
`shop` (`docs/service-shop-boundary-violations-fix/`) исключение сузилось — `SalesPlan`/
`SalesPlanTemplate`/`TaskCompletion` остаются общими только на уровне физической Prisma-таблицы
(дискриминатор `direction`, решение пользователя — таблицы не разбиваются по доменам), но CRUD плана
продаж `shop` больше не диспатчит команды `service` через общий `CommandBus` — это собственные
CQRS-хендлеры `domains/shop/modules/sales/application/command/*`. Часть найденного ниже — сознательный выбор архитектуры, задокументированный в коде;
однако там, где дублируется **чистая расчётная математика без ERP-специфики**, это прямо противоречит
DRY-принципу для денежных вычислений и создаёт риск расхождения логики при будущих правках.

- **[Важно]** Чистая расчётная логика продублирована файл-в-файл между доменами, хотя ERP-специфики в
  ней нет:
  - `domains/service/modules/accounting/domain/services/money.ts` vs
    `domains/shop/modules/accounting/domain/services/money.ts` — идентичный `roundRubles()`.
  - `domains/service/.../float-percent.ts` vs `domains/shop/.../float-percent.ts` —
    `resolveFloatPercentMultiplier()`/`buildFloatPercentThresholdInfo()`: идентичный алгоритм
    интерполяции по трём порогам (FIX/LINEAR); комментарий в shop-версии сам признаёт совпадение
    реализаций.
  - `domains/service/.../period-calculation.orchestrator.ts` vs
    `domains/shop/.../period-calculation.orchestrator.ts` — тело `calculate()`/`total()` идентично,
    отличается только тип `SalaryRule`/`ShopSalaryRule` в сигнатуре — обобщается дженериком
    (`PeriodCalculationOrchestrator<TContext, TRule>`) без потери направленной независимости.
  - `get-sales-performance.service.ts:16-18,86-100` (service) vs
    `get-sales-performance.service.ts:14-16,87-101` — функция `scopeKey()` и метод
    `findForScope()` совпадают дословно.
  - **Фикс**: перенести money/float-percent/orchestrator/scopeKey в `src/shared/domain/` как
    обобщённые (дженерик по типу правила/контекста) утилиты — они не содержат ERP-специфики и не
    нарушают декларируемую независимость бизнес-правил каждого домена.
- **[Важно]** Application-сервисы отчётов по зарплате почти дословно продублированы:
  `get-employee-salary-report.service.ts:108-279` (service) и
  `get-employee-salary-report.service.ts:108-282` (shop) — методы построения FACT/PROGNOSE веток
  закрытого и открытого периода и сборки ответа совпадают вплоть до идентичных фрагментов кода
  (различаются только литералы `direction`). Аналогично `get-department-salary-report.service.ts:128-197,303-347`
  и `get-department-salary-report.service.ts:128-199,415-460`. Риск: правка бага в одной ветке
  (например, в трактовке closed-периода) не гарантированно попадёт в зеркальную.
- **[Минор]** Мапперы Prisma↔Entity (`salary-rule.mapper.ts`/`salary-rule.mapper.ts`,
  `task-completion.mapper.ts`/`task-completion.mapper.ts`,
  `motivation-schema.mapper.ts`/`motivation-schema.mapper.ts`) — типовой `toDomain`/`toPersistence`
  boilerplate, ожидаемый для DDD-мапперов поверх общего интерфейса `Mapper<T,R>`; риск низкий,
  дальнейшее обобщение не обязательно.
- **[Минор]** `contracts/commands/shop-salary-rule.ts:43-46` (`payPerHourShopSalaryConfigSchema`)
  побайтово идентична `contracts/commands/salary-rule.ts:85-88`
  (`payPerHourSalaryConfigSchema`) — единственная не факторизованная схема; в остальном `contracts/`
  уже хорошо переиспользуется (`targetRoleSchema`, `percentBordersSchema`,
  `individualBonusFieldSchema` и др. используются обеими сторонами напрямую).
- **[Минор]** Структурный (не построчный) паттерн синхронизации — постраничная загрузка →
  топологическая сортировка иерархии перед upsert → батч `Promise.all` → транзакция с
  `createMany({skipDuplicates:true})` — совпадает между `roapp-sync.service.ts` и
  `moysklad-sync.service.ts`, но именно отсутствие общего вынесенного шаблона стало причиной
  критического бага в п. 5.2 ниже (одно из двух зеркальных мест «забыло» вызов при копипасте).
- **Дублирования не найдено** (проверено целенаправленно, подтверждено как сознательно общий или
  структурно разный код): ~~CRUD плана продаж (`create/update/delete/approve-sales-plan`) —
  контроллеры `shop` лишь диспатчат команды `service` через общий `CommandBus`, бизнес-логика
  физически не скопирована~~ — **устарело**: с Фазы 7 `docs/service-shop-boundary-violations-fix/`
  `shop` завёл собственные независимые CQRS-команды CRUD плана продаж
  (`domains/shop/modules/sales/application/command/*`), бизнес-логика теперь и физически
  продублирована (осознанно, вместе с остальным периметром `accounting`/`sales`), а не диспатчится в
  `service`; `marketing/pricing` — service- и shop-версии решают структурно разные задачи
  (синхронный апдейт цен в RoApp vs асинхронная job с XLSX/AI-матчингом/Google Sheets), общего кода
  нет и делить нечего; zod-схемы валидации ответов внешних ERP (`roapp/schemas/*`,
  `moySklad/schemas/*`) намеренно не вынесены в `contracts/` — это backend↔ERP контракт, а не
  backend↔frontend, вынос был бы архитектурной ошибкой, а не улучшением.

## 5. Пробелы в логике (потенциальные баги)

### 5.1 Синхронизация с ERP

- **[Критично]** `backend/src/domains/service/sync/roapp/roapp-sync.service.ts:491-498`
  (`getOrdersToUpdateItems`) — фильтр `managerSalary: null` в выборке заказов для обновления позиций
  «замораживает» `cost`/`engineerSalary`/`managerSalary` заказа сразу после первой успешной обработки
  (эти поля выставляются один раз, строки 479-485, и никогда не сбрасываются в `null`). Cron
  (`roapp-sync.cron.ts`) каждые 5 минут корректно получает от RoApp список действительно изменившихся
  заказов и передаёт их в `uploadOrderItems(orderIds)`, но этот дополнительный фильтр молча
  исключает из пересчёта любой заказ, который уже проходил синк хотя бы раз — даже если у него
  изменился состав позиций или наконец проставилась оплата. При этом
  `service-calculation-data.repository.ts:99-105` использует именно `RoappOrder.payed/cost/
  engineerSalary` как источник данных для правила `OrderPayed` в модуле `accounting` — то есть
  зарплатные отчёты по факту используют замороженные на момент первого синка суммы, не отражающие
  более поздние изменения заказа. **Фикс**: убрать фильтр `managerSalary: null` из ветки с явным
  списком `orderIds` (список и так уже ограничен реально изменившимися заказами) либо завести
  отдельный технический признак «позиции устарели» вместо использования бизнес-поля как флага «был ли
  обработан».
- **[Критично]** `backend/src/domains/shop/sync/moySklad/moysklad-sync.cron.ts` — в отличие от
  зеркального `roapp-sync.cron.ts:16-17,35` (инжектит `DOMAIN_SYNC_STATUS`, вызывает
  `domainSyncStatus.markSuccessful('service')` после успешного тика), shop-версия крона токен
  `DOMAIN_SYNC_STATUS` вообще не инжектирует и `markSuccessful('shop')` нигде не вызывает (грепом
  `markSuccessful` по всему backend — единственное вхождение вызова для `'service'`); модуль
  `moysklad-sync.module.ts:7-16` даже не импортирует `DomainSyncStatusModule`. Следствие:
  `DomainSyncStatusRepository.getLastSuccessfulSyncAt('shop')` всегда возвращает `null` →
  `accounting-cache-freshness.ts` трактует последнюю успешную синхронизацию МойСклад как «никогда» —
  один из трёх штампов инвалидации ленивого кэша зарплатных расчётов `shop` не срабатывает вообще.
  Практически: после появления новой отгрузки/продажи в МойСклад отчёт по зарплате продавца может
  отдавать устаревшую закэшированную сумму сколь угодно долго, пока кто-то вручную не изменит
  мотивационную схему или план продаж (два других триггера инвалидации). Похоже на баг, возникший
  именно из-за копирования крона без вынесенного общего шаблона (см. п. 4). **Фикс**: добавить
  инъекцию `DOMAIN_SYNC_STATUS` и вызов `markSuccessful('shop')` в `moysklad-sync.cron.ts` по образцу
  `roapp-sync.cron.ts`, импортировать `DomainSyncStatusModule` в `moysklad-sync.module.ts`.
- **[Важно]** `roapp-sync.service.ts:313-334` (`uploadOrderItems`) и `_uploadOrders` (284-311) —
  нет continue-on-error: единичная ошибка парсинга/апсерта одного заказа (`try/catch` логирует и
  делает `rethrow`) прерывает весь цикл `for await` по остальным страницам, а `Promise.all` на
  странице реджектится целиком при падении одного элемента. В связке с `RoappSyncCron`, который не
  сдвигает `failedSince` при ошибке, «отравленная» запись (например, форма данных заказа, не
  покрытая zod-схемой) останавливает инкрементальный синк заказов *для всего домена service*
  на каждом последующем тике, пока запись не будет исправлена вручную — окно `since` только растёт.
  **Фикс**: изолировать обработку каждого заказа/страницы собственным try/catch, продолжать при
  ошибке отдельного элемента, копить список сбойных id отдельно для алертинга.
- **[Важно]** `backend/src/domains/shop/integrations/moySklad/moysklad.service.ts` (`dumpError`,
  строки ~23-62) — сам диагностический код не обёрнут в try/catch: если запись `error.json` на диск
  не удаётся (read-only контейнер, нет прав, диск переполнен), из `catch`-блока вылетает ошибка
  файловой системы вместо запланированного `BadGatewayException`, а исходная причина сбоя
  интеграции теряется. Дополнительно все параллельные вызовы пишут в один и тот же константный путь
  `error.json` — гонка записи при массовом одновременном сбое. **Фикс**: обернуть `dumpError` в
  собственный try/catch (максимум `console.error` при неудаче записи), использовать уникальное имя
  файла (timestamp/uuid).
- **[Важно]** Все три крона синхронизации (`roapp-sync.cron.ts`, `moysklad-sync.cron.ts`,
  `bitrix-sync.cron.ts`) не защищены от наложения (overlap) запусков — нет флага `isRunning`/мьютекса.
  `@nestjs/schedule` не гарантирует завершения предыдущего тика до следующего; при батче, который
  из-за троттлинга (`delay(500)` между заказами) не укладывается в 5-минутный интервал, следующий тик
  стартует параллельно — гонка за приватное поле `failedSince`, дублирующая нагрузка на ERP API и пул
  соединений БД именно в момент, когда система и так отстаёт. **Фикс**: простой `isRunning`-флаг
  вокруг `run()`.
- **[Важно]** `roapp.instace.ts:6-9` и `moysklad.instance.ts:6-9` — `axios.create()` без `timeout`
  (по умолчанию `0`, то есть бесконечное ожидание) и без retry/backoff. Зависший ответ внешнего ERP
  вешает весь sync-тик на неопределённое время вместо быстрого сбоя и ретрая через 5 минут. **Фикс**:
  задать `timeout` (30-60с) на обоих клиентах, рассмотреть `axios-retry` для транзиентных ошибок.
- **[Минор]** `roapp-sync.mappers.ts` (`topoSortCategories`, 38-54; `resolveServiceCategoryAncestors`,
  69-101) и `moysklad-sync.mappers.ts` (`topoSortFolders`, 71-89) не защищены от циклов в иерархии
  (`parentId` зацикленный на себя из-за порчи данных на стороне ERP): `topoSort*` уйдёт в
  `RangeError: Maximum call stack size exceeded`, а `resolveServiceCategoryAncestors` (`while` без
  set посещённых) — в бесконечный синхронный цикл, блокирующий весь event loop процесса целиком.
  Вероятность низкая, цена события высокая (полная недоступность бэкенда, а не изолированный сбой).
  **Фикс**: classic DFS с «серым» множеством узлов в процессе обхода, явная ошибка вместо
  переполнения стека/зависания.
- **[Минор]** `moysklad.service.ts` (`formatMoyskladDateTime`, ~208-215) формирует naive-строку даты
  из UTC-компонентов `Date` без явного указания зоны; если МойСклад интерпретирует такие фильтры в
  часовом поясе аккаунта (обычно UTC+3), окно `updatedFrom` в синке отгрузок сдвинуто — риск
  расхождения не проявится в тестах (моки), только в проде. **Фикс**: явно задокументировать/
  зафиксировать часовой пояс аккаунта МойСклад, конвертировать явно, а не полагаться на UTC.
- **[Минор]** `roapp-sync.service.ts:383-389` (`fetchServiceBonusById` в цикле по `missingServiceIds`)
  — единственное место без `delay(...)` между последовательными HTTP-вызовами к RoApp (везде рядом
  используется `delay(500)`), риск 429 при заказе с большим числом новых услуг.
- **[Минор]** `roapp.service.ts:239-261` (`fetchMarketingSources`) использует сырой `fetch()` с
  захардкоженным URL вместо общего `this.roApp.instance` (дублирует `baseURL`, не получит выгоды от
  будущих общих настроек timeout/retry) и не проверяет `res.ok` перед `res.json()`.
  `roapp.service.ts:68` — `console.log(error)` вместо `Logger`, единственное такое место в
  интеграционном слое (риск утечки токена авторизации в stdout при сериализации ошибки axios).

### 5.2 Расчёт зарплаты (accounting)

- **[Критично]** Денежные поля `price`/`percent`/`basePercent`/`basePrice` в `contracts/commands/
  salary-rule.ts` (строки 101,123,126,132,160,163) и `contracts/commands/shop-salary-rule.ts`
  (67,70,76,105,108,135,138) объявлены как `z.number()` без `.int()` — при том, что
  `individualBonusFieldSchema` (`salary-rule.ts:43`) уже явно требует `.int()` с комментарием «денежные
  поля во всём модуле accounting — целые рубли». При этом ветки `Fixed` в правилах (`order-payed.entity.ts:81-90`,
  `service-completed.entity.ts:77-86`, `task-completed.entity.ts:83-92` в обоих доменах) не
  оборачивают результат в `roundRubles()`, в отличие от процентных веток. Если ставка `Fixed`
  задаётся дробным числом (ничто в API/схеме этого не запрещает), `PeriodCalculationOrchestrator.total()`
  просуммирует дробную строку, и Prisma при записи в `Int`-колонку (`AccountingCalculationCache.
  factTotal/prognoseTotal` — при каждом обращении к открытому отчёту;
  `AccountingPeriodSnapshot.total` — при закрытии периода) бросит ошибку валидации типа. Для отчёта
  сотрудника это разово ломает эндпоинт (500); для закрытия периода — весь `unitOfWork.run(...)`
  в `close-accounting-period.handler.ts:99-111` откатится целиком, то есть закрытие периода не
  пройдёт ни для одного сотрудника из-за одной некорректно настроенной ставки. **Фикс**: добавить
  `.int()` к `price`/`percent`/`basePercent`/`basePrice` во всех zod-схемах (как уже сделано для
  `bonus`) и/или обернуть `roundRubles()` вокруг результата во всех ветках `Fixed`.
- **[Важно]** `backend/src/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity.ts:140-152` —
  в ветке `FloatPercent`, когда для категории правила нет строки `salesPerformance`
  (`percentCompletion === undefined`), метод возвращает `amount: 0`, полностью теряя
  `bonus` (индивидуальную фиксированную надбавку). Во всех остальных ветках того же файла (`Fixed`,
  строка 101; `FixedPercent`, строка 113) и во всех аналогичных правилах обоих доменов `bonus`
  добавляется к сумме всегда, независимо от результата основной формулы — по замыслу самого поля
  («надбавка поверх расчёта по основной формуле», см. комментарий у `individualBonusFieldSchema` в
  contracts) бонус не должен зависеть от того, посчиталась ли база. Сотрудник теряет персональную
  надбавку просто из-за отсутствия плана/факта продаж по его категории в конкретном периоде — состояние,
  не связанное с наличием у него бонуса. **Фикс**: `amount: bonus` вместо `amount: 0` в этой ветке.
- **[Важно]** `to-salary-report-rules.ts:64-77` (`buildThresholdInfo`) получает один общий
  `performance: ShopSalesPerformance` (department-level, `category: null`) на все правила отчёта
  (вызовы — `get-employee-salary-report.service.ts:219`,
  `get-department-salary-report.service.ts:322`), тогда как реальная сумма правила `ProductSold`
  с непустой `config.category` считается по `percentCompletion` именно этой категории
  (`product-sold.entity.ts:140-152`, карта `salesPerformanceByCategory`). В результате показанные в
  ответе `currentThreshold`/`nextThreshold`/`diffToNext` («до следующего порога осталось N ₽»)
  считаются от оборота всего отдела, а не категории правила — цифра, которую видит пользователь, не
  соответствует фактически применённому множителю. **Фикс**: передавать в построение breakdown карту
  `salesPerformanceByCategory` и выбирать `performance` по `rule.config.category`, а не единый
  параметр на все правила.
- **[Минор]** Расходящаяся стратегия обработки отсутствующего `SalesPerformance`: `OrderPayedEntity`/
  `TaskCompletedEntity` (service) и `TaskCompletedShopEntity` (shop) в этом случае **бросают**
  `SalesPerformanceRequiredException` (валят весь отчёт по сотруднику ошибкой 500), а
  `ProductSoldEntity` (см. находку выше) в аналогичной ситуации **молча обнуляет** строку без
  индикации проблемы. Непредсказуемо для вызывающего кода/UI — часть сбоев данных проявляется явной
  ошибкой, часть — тихо заниженной зарплатой. **Фикс**: унифицировать стратегию на весь модуль (либо
  везде fail-loud с понятным доменным исключением, либо везде явный признак «строка не рассчитана» в
  ответе).
- **[Минор]** `close-accounting-period.handler.ts:81-90` / `close-accounting-period.handler.ts:96-105` —
  при отсутствии строки `AccountingPeriod` в БД каждый параллельный запрос на закрытие создаёт
  новую сущность со своим `randomUUID()`; `accounting-period.repository.ts` пишет через `upsert` по
  `id`, поэтому при гонке двух запросов второй `create` упадёт на составном уникальном индексе
  `(direction, period)` сырым `PrismaClientKnownRequestError` (P2002) вместо понятного доменного
  исключения «период уже закрывается». Оптимистичной блокировки уже существующего периода (например,
  `WHERE status = 'OPEN'`) тоже нет — параллельные `close` дублируют дорогой расчёт по всем
  сотрудникам, данные не бьются, но какой из параллельных запросов «выигрывает» снапшот —
  непредсказуемо. **Фикс**: транзакционная проверка/захват периода перед тяжёлым расчётом (advisory
  lock по `(direction, period)` или условный `UPDATE ... WHERE status = 'OPEN'`), оборачивание P2002
  в доменное исключение.
- **[Минор]** `close-accounting-period.handler.ts:120-148` / `close-accounting-period.handler.ts:135-167` —
  контекст расчёта (ERP-данные, идентичности, часы) собирается последовательно на каждого сотрудника
  внутри `for`-цикла, хотя сам проект формулирует принцип «контекст собирается один раз на отдел,
  чтобы не было N+1» именно для отчёта отдела (`domains/service/CLAUDE.md`) — закрытие периода эту
  оптимизацию не переиспользует. При большом штате операция закрытия периода может стать заметно
  медленнее, чем аналогичный по объёму данных отчёт по отделу.
- **[Минор]** Проверка «все строки плана продаж утверждены» (`close-accounting-period.handler.ts:64-79`)
  выполняется до тяжёлого расчёта и до входа в `unitOfWork.run`, без повторной проверки внутри
  транзакции непосредственно перед `periodEntity.close(...)` — узкое, но реальное окно TOCTOU, где
  снятие утверждения плана между проверкой и коммитом не остановит закрытие периода с устаревшими
  данными.
- **[Минор]** `employee-hours-entry.entity.ts` (`validate()`, ~44-60) проверяет только `hours < 0`,
  верхней границы (например, ≤ 744 часа/месяц) нет — можно ввести произвольно большое число часов
  вручную, которое без дополнительной защиты уйдёт в `PayPerHoursEntity.calculate()` и создаст
  произвольно большую зарплатную строку.

### 5.3 Прочее

- **[Минор]** `backend/src/shared/initialUploadData.ts:9-10,33` — `const erp = process.argv[3]` не
  проверяется на `undefined` (в отличие от соседней проверки `dateArg` строками выше), затем
  `erp.includes('B')` упадёт `TypeError`, если аргумент не передан, вместо понятного сообщения
  использования, как это уже сделано для `dateArg`. Малый риск (одноразовый CLI-скрипт), но
  несогласованность с соседней проверкой в том же файле.

## 6. Прочее (безопасность, тесты, мусорные файлы)

- **[Критично]** Авторизация фактически отсутствует почти на всём HTTP API. Из 60 HTTP-контроллеров
  под `domains/{service,shop}/modules/*` (accounting, sales, reports, warehouse, marketing/pricing)
  — **ноль** используют `@UseGuards`; глобального гарда через `APP_GUARD` в `app.module.ts` тоже нет.
  Единственное исключение — 5 контроллеров модуля `employee-identity`
  (`@UseGuards(PortalAdminGuard)`). Это означает, что при отсутствии дополнительной защиты на уровне
  сети/прокси эндпоинты зарплатных отчётов сотрудников (`GET .../salary_report/employee/:id/:period`),
  закрытия/переоткрытия расчётного периода, планов продаж, воронки сделок и т.д. доступны без какой-
  либо проверки личности вызывающего. Для платформы, чей смысл — «единая точка сбора данных всей
  компании», включая персональные данные о зарплате, это высокорисковая конфигурация независимо от
  того, компенсируется ли она сейчас периметром сети (VPN/файрвол) — в коде эта гарантия никак не
  выражена и рискует быть нарушена при следующем изменении инфраструктуры (например, публикация
  порта наружу для нового клиента). **Фикс**: как минимум завести общий гард по аналогии с
  `PortalAdminGuard` (или менее строгий «аутентифицирован через Bitrix» гард без требования роли
  администратора) и применить его глобально через `APP_GUARD`, либо явно задокументировать и
  зафиксировать в инфраструктуре (не в коде) периметр, которым сейчас закрыт доступ.
- **[Важно]** `backend/src/main.ts:13-17` — `app.enableCors({ origin: true, credentials: true, ... })`.
  `origin: true` отражает Origin любого сайта, сделавшего запрос, а не список разрешённых доменов; в
  сочетании с `credentials: true` это классическая небезопасная конфигурация CORS — любая веб-страница
  в браузере пользователя, у которого есть валидная сессия/cookie к API, теоретически может делать к
  нему кросс-доменные запросы с credentials. Текущая модель авторизации не завязана на cookie (заголовок
  `x-bitrix-auth` передаётся явно фронтендом), поэтому прямой эксплуатации через эту связку сейчас,
  вероятно, нет, но конфигурация всё равно рискованная и должна быть сужена до конкретного списка
  разрешённых origin (frontend-домены), особенно учитывая пункт про отсутствие авторизации выше.
- **[Минор]** Rate limiting отсутствует (в `package.json` нет `@nestjs/throttler` и аналогов) — при
  открытом (см. выше) API нет защиты от простого перебора/DoS на уровне приложения.
- **[Минор]** Тестовое покрытие неравномерно: 134 spec-файла на 509 файлов исходного кода (≈26%,
  включая e2e), сосредоточено почти целиком в `modules/accounting` и `modules/sales` (у которых есть
  и юнит-, и e2e-тесты). У sync-сервисов (`roapp-sync.service.ts`, `moysklad-sync.service.ts`,
  `bitrix-sync.service.ts`) и особенно у их cron-обвязки (`*-sync.cron.ts`, где и найден баг из
  п. 5.1 про `markSuccessful`) выделенных тестов на сам `.cron.ts`-класс нет — что напрямую объясняет,
  почему баг с пропущенным вызовом не был пойман автоматически при копировании кода.
- **[Минор]** Мусорные файлы в рабочем дереве, не предназначенные для коммита: `backend/test.json` и
  корневой `test.json` (дампы дерева категорий товаров, ~50-70 КБ, судя по всему — результат ручного
  прогона/отладки) и `contracts/commands/salary-rule.ts.tmp.8427.3ca28e57fbe6` (побайтовая копия
  `salary-rule.ts` — похоже на артефакт прерванной атомарной записи файла). Ни один из них не
  игнорируется `.gitignore` (диф `.gitignore` в рабочем дереве добавляет только пустую строку).
  **Фикс**: удалить все три файла, добавить `*.tmp.*` и точечные записи для дебаг-дампов в
  `.gitignore`, если такие дампы — ожидаемый побочный эффект локальной разработки.
- **Не найдено**: SQL-инъекций (весь доступ к БД — через Prisma Client, сырых `$queryRawUnsafe` не
  найдено), секретов, захардкоженных в исходном коде (проверены `src/config/*.ts` — используются
  только `process.env.*`), избыточного использования `any` (см. «Сильные стороны»).

## Рекомендации (приоритизированный план действий)

1. **Критично, чинить в первую очередь**:
   - Убрать фильтр `managerSalary: null` в `roapp-sync.service.ts:494` — заказы `service` сейчас не
     пересчитываются после первого синка (п. 5.1).
   - Добавить `markSuccessful('shop')` в `moysklad-sync.cron.ts` — freshness-кэш зарплаты `shop` не
     инвалидируется по факту синка ERP (п. 5.1).
   - Добавить `.int()` к денежным полям `Fixed`-правил в `contracts/commands/{salary-rule,
     shop-salary-rule}.ts` и обернуть `Fixed`-ветки в `roundRubles()` — иначе некорректно введённая
     дробная ставка ломает закрытие периода целиком (п. 5.2).
   - Решить вопрос авторизации HTTP API — либо гард на уровне приложения, либо явная фиксация
     периметра защиты вне кода (п. 6).
2. **Важно, в ближайших итерациях**:
   - Фикс потери `bonus` в `ProductSoldEntity` и неверного scope порогов `FloatPercent` в отчёте
     `shop` (п. 5.2).
   - Continue-on-error и `isRunning`-защита от overlap в трёх cron-синках, `timeout` на axios-клиентах
     (п. 5.1).
   - Сузить CORS (`origin: true` → явный список доменов) (п. 6).
   - ~~Вынести `accounting-cache-freshness.ts`, `money.ts`, `float-percent.ts`,
     `period-calculation.orchestrator.ts`, `scopeKey()`/`findForScope()` в `src/shared` — устранить
     дублирование чистой расчётной логики между доменами (п. 2, 4).~~ **Устарело (2026-08-27)**:
     решение пользователя по итогам `docs/service-shop-boundary-violations-fix/` — не выносить в
     `shared`, а завести у каждого домена собственную независимую копию (сделано для
     `accounting-cache-freshness.ts`/`AccountingPeriod`/`SalesPlan`/`ErpCashDocument`/`SalaryAccrual`);
     `money.ts`/`float-percent.ts`/`period-calculation.orchestrator.ts`/`scopeKey()`/`findForScope()`
     остаются продублированными по тому же принципу — это больше не открытая рекомендация, а
     подтверждённая архитектура.
3. **Минор, по мере возможности**:
   - Общий шаблон постраничной синхронизации (`runPagedUpload`) в `src/shared/sync/` — устранит
     часть найденных в п. 5.1 проблем в одном месте и сократит размер sync-сервисов (п. 1, 3).
   - Защита от циклов в `topoSortCategories`/`topoSortFolders`/`resolveServiceCategoryAncestors`.
   - Унификация стратегии обработки отсутствующего `SalesPerformance` (fail-loud вместо тихого нуля).
   - Уборка мусорных файлов (`test.json` × 2, `salary-rule.ts.tmp.*`) и обновление `.gitignore`.
   - Актуализация комментария про `SalaryModule` в `app.module.ts` и раздела `domains/service/CLAUDE.md`.
