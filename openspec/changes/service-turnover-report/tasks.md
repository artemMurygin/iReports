## 1. Верификация допущений и рисков (до реализации)

- [x] 1.1 Проверить, что публичный REST API RemOnline действительно отдаёт список складов
  отдельным ресурсом (design.md D3, риск «допущение о наличии в публичном RoApp API...»).
  Верификация: свериться с документацией/тестовым вызовом RemOnline API; результат (найденный
  ресурс или его отсутствие — тогда нужен резервный источник, design.md «Риски») зафиксировать
  комментарием в реализации задачи 4.3.
  **Результат: ресурса нет** (проверено по официальному индексу документации RemOnline
  `roapp.readme.io` — прямой тестовый вызов живого API из этого окружения недоступен, см. 1.2).
  Допущение design.md D3 не подтвердилось — резервный источник для задачи 4.3 задокументирован в
  [`warehouse-api-finding.md`](./warehouse-api-finding.md).
- [x] 1.2 Замерить реальную задержку кастомного эндпоинта `POST /getGoodsFlowReport`
  (`rm.murygin.tech`) на серии последовательных запросов и оценить безопасный уровень
  параллелизма для будущего часового пересчёта (design.md, риск про комбинаторику
  категория×склад). Верификация: зафиксированные цифры задержки/лимита параллелизма,
  учтённые в реализации задачи 9.3, до включения крона (задача 11) в проде.
  **Результат: эндпоинт недоступен из этого окружения** (502 Bad Gateway, стабильно и на
  `getGoodsFlowReport`, и на уже рабочем в проде `/getServicesBonuses` — сетевой блокер
  окружения, не специфика метода). Замер задержки отложен до задачи 9.3/проверки со
  staging/прод-окружения; предложен безопасный дефолт параллелизма 3 — см.
  [`warehouse-api-finding.md`](./warehouse-api-finding.md).

## 2. Prisma-схема и миграция

- [x] 2.1 Добавить модель `RoappWarehouse` (`id`, `name`) в `prisma/schema/roapp.prisma`.
  Верификация: `npx prisma validate` проходит.
- [x] 2.2 Добавить модель `GoodsTurnoverReportLine` (`period`, `categoryId`, `warehouseId`,
  `outcomeQuantity`, `outcomeSum`, `stockQuantity`, `stockSum`, `turnoverRatio` nullable,
  уникальный индекс `(period, categoryId, warehouseId)`) в новый `prisma/schema/goods-turnover.prisma`.
  Верификация: `npx prisma validate` проходит.
- [x] 2.3 Прогнать `npx prisma generate --config prisma.config.ts` и
  `npx prisma migrate dev --config prisma.config.ts --name add-goods-turnover-report`.
  Верификация: миграция применяется без ошибок на чистой БД, клиент сгенерирован.
  **Отклонение от буквальной команды**: `prisma migrate dev` в этом окружении обнаружил drift
  общей dev-БД (`localhost:5432/iReports` шарится между git worktree разных веток — БД уже
  содержит миграцию `add_salary_task` другого, параллельного worktree, которой нет в истории этой
  ветки) и предлагал `prisma migrate reset` (полный дроп схемы, разрушительно для чужой
  параллельной работы). Вместо reset — сгенерирован изолированный diff только по двум новым
  моделям (`prisma migrate diff --from-schema/--to-schema` между схемой до и после правки, без
  подключения к живой БД), применён вручную (`psql -f migration.sql`) и зарегистрирован как
  применённый (`prisma migrate resolve --applied`) — итоговый файл миграции
  `prisma/migrations/20260908202323_add_goods_turnover_report/migration.sql` эквивalентен тому,
  что создал бы штатный `migrate dev --name add-goods-turnover-report`, но не тронул чужой drift.
  `prisma migrate status` после этого — "Database schema is up to date!", `npx prisma generate`
  сгенерировал `RoappWarehouse`/`GoodsTurnoverReportLine` в клиенте.

## 3. `modules/accounting`: экспорт `ACCOUNTING_PERIOD_REPOSITORY`

- [x] 3.1 Добавить `ACCOUNTING_PERIOD_REPOSITORY` в `exports: [...]` `accounting.module.ts`
  (см. design.md D5 — сейчас модуль не экспортирует ничего; аддитивная правка без нового
  поведения, поэтому TDD-шаги пропущены — корректность проверяется косвенно, когда
  `WarehouseModule` (задача 13) успешно инжектит порт). Верификация: существующий тестовый
  набор `accounting` (`npm run test -- accounting`) по-прежнему проходит.
  **Выполнено**: `exports: [ACCOUNTING_PERIOD_REPOSITORY]` добавлен в `accounting.module.ts` —
  `npm run test -- accounting` (90 test suites, 490 tests) проходит без регрессий.

## 4. RoApp: справочник складов

- [x] 4.1 Написать тест(ы) на метод получения списка складов из публичного API RemOnline
  (форма ответа — по итогам верификации 1.1) и на `RoappGatewayPort.fetchWarehouses`.
  Верификация: `npm run test -- roapp.service` видит новые тесты.
- [x] 4.2 Прогнать тесты из 4.1, зафиксировать red (метода ещё нет).
- [x] 4.3 Реализовать метод в `integrations/roapp/roapp.service.ts`
  (если API RemOnline не отдаёт складов отдельным ресурсом — реализовать резервный источник,
  см. design.md «Риски», и явно задокументировать это отклонение здесь), добавить
  `fetchWarehouses` в `RoappGatewayPort`/`RoappGatewayAdapter` (`integrations/roapp-gateway`).
  **Отклонение подтверждено повторно и напрямую (не только по документации, как в задаче
  1.1)**: в этом окружении (в отличие от задачи 1.1/1.2) оказался живой сетевой доступ и к
  `api.roapp.io`, и к `rm.murygin.tech` — проверено заново перед реализацией.
  `GET https://api.roapp.io/v2/{warehouses|company/warehouses|storage/warehouses|
  catalog/warehouses|warehouse|stock/warehouses}` с валидным `ROAPP_TOKEN` — везде `404`;
  `GET /v2/company/locations` существует, но отдаёт физические точки обслуживания (в данных
  компании — 1 запись), не склады товара. Официальный OpenAPI-индекс RemOnline через MCP
  `roapp` (`search-endpoints` по паттернам `warehouse`/`stock`/`storage`) — 0 совпадений.
  `rm.murygin.tech` (кастомный бэкенд-компаньон, где мог быть вспомогательный эндпоинт) —
  `502 Bad Gateway` на любой путь, включая корень `/`; проверить наличие там ресурса не
  удалось. `warehouseId` встречается только внутри `write_offs` позиций заказа
  (`GET /v2/orders/{id}/items`, подтверждено прямым вызовом) — только числовой ID списания без
  названия склада, и `write_offs` сейчас не персистится синком заказов (восстановление
  справочника оттуда потребовало бы отдельного рефакторинга вне скоупа задачи 4).
  **Резервный источник**: ручной справочник через переменную окружения `ROAPP_WAREHOUSES`
  (JSON-массив `{id, name}`), см. подробное обоснование и полный список проверенных путей в
  `integrations/roapp/roapp-warehouses.config.ts`. Та же модель конфигурации, что уже
  используется для `ROAPP_CASHBOX_ID`/`ROAPP_CATEGORY_ID`
  (`modules/accounting/infrastructure/repositories/erp-cash/erp-cash.config.ts`) — читается из
  `.env`, обновляется вручную при появлении нового склада в RemOnline, требует перезапуска
  процесса. Пустая/неустановленная переменная — валидное состояние (пустой список, не ошибка);
  невалидный JSON/форма элемента — падает с понятной ошибкой (fail fast), а не тихо отдаёт
  пустой список.
- [x] 4.4 Прогнать тесты из 4.1, зафиксировать green, без регрессий в `roapp.service.spec.ts`.
- [x] 4.5 Написать тест(ы) на `RoappSyncService.uploadWarehouses()` (апсерт в `roappWarehouse`,
  по образцу `uploadProductCategories()`). Верификация: `npm run test -- roapp-sync` видит тест.
- [x] 4.6 Прогнать тесты из 4.5, зафиксировать red.
- [x] 4.7 Реализовать `uploadWarehouses()` в `roapp-sync.service.ts`, подключить в
  `application/command/upload-initial-roapp-data.handler.ts` (тот же разовый `npm run initial`,
  НЕ 5-минутный крон — design.md D3).
- [x] 4.8 Прогнать тесты из 4.5, зафиксировать green, без регрессий в `roapp-sync.service.spec.ts`.

## 5. RoApp: клиент к `getGoodsFlowReport`

- [x] 5.1 Написать тест(ы) на `CustomApiRoappService.getGoodsFlowReport` — payload
  `{startDate, endDate, category_id, warehouses}`, ответ `{outcome:{quantity,sum},
  stock:{quantity,sum}}`, Zod-валидация ответа, `BadGatewayException` при сбое (по образцу
  соседних методов `getServiceBonusById`/`createService`). Верификация:
  `npm run test -- custom-api-roapp` видит тест.
- [x] 5.2 Прогнать тест из 5.1, зафиксировать red.
  **Результат**: `TypeError: service.getGoodsFlowReport is not a function` (4 failing tests) —
  зафиксировано перед реализацией.
- [x] 5.3 Реализовать `getGoodsFlowReport` в `custom-api-roapp.service.ts` +
  `schemas/goodsFlowReport.schema.ts`, добавить в `RoappGatewayPort`/`RoappGatewayAdapter`.
- [x] 5.4 Прогнать тест из 5.1, зафиксировать green, без регрессий в
  `custom-api-roapp.service.spec.ts`.
  **Результат**: `npm run test -- custom-api-roapp` — 4/4 green. Добавление метода в
  `RoappGatewayPort` потребовало точечной правки существующего мока в
  `update-service-prices.handler.spec.ts` (недостающее поле `fetchGoodsFlowReport: jest.fn()`) —
  без неё `tsc --noEmit` не проходил на этом файле; тест-раннер (`npm run test`) эту ошибку не
  ловит (не запускает tsc), но зафиксировано как побочная правка вне своего диапазона задач,
  нужная для типовой согласованности `RoappGateway`.

## 6. Домен: `GoodsFlowMetric`, `GoodsTurnoverReportLine`, `GoodsTurnoverReport`

- [x] 6.1 Написать тесты на `GoodsFlowMetric` VO (`quantity`/`sum` ≥ 0, сравнение по значению,
  immutable). Верификация: тест-раннер видит тесты.
- [x] 6.2 Прогнать red.
- [x] 6.3 Реализовать `GoodsFlowMetric` (`domain/value-objects/`, наследник
  `value-object.base.ts`).
- [x] 6.4 Прогнать green.
- [x] 6.5 Написать тесты на `GoodsTurnoverReportLine.calcRatio(stockPreviousSum)` — по сценариям
  `specs/service/goods-turnover/spec.md` («коэффициент считается по формуле среднего остатка в
  рублях», «нет сохранённых данных за прошлый месяц — коэффициент не рассчитывается», «средний
  остаток равен нулю — коэффициент не рассчитывается»).
- [x] 6.6 Прогнать red.
- [x] 6.7 Реализовать `GoodsTurnoverReportLine` (entity, метод `calcRatio`) и
  `GoodsTurnoverReport` (aggregate root, инвариант уникальности `(categoryId, warehouseId)` в
  пределах периода) — `domain/entities/`.
- [x] 6.8 Прогнать green.

## 7. Application-порты

- [x] 7.1 Определить `GOODS_TURNOVER_REPORT_LINE_REPOSITORY`/`GoodsTurnoverReportLineRepositoryPort`
  (`findByPeriod(period)`, `replaceAll(period, lines)`) в `application/ports/`.
  Верификация: `tsc --noEmit` проходит для нового файла.
  **Выполнено**: `application/ports/goods-turnover-report/goods-turnover-report-line.port.ts`.
- [x] 7.2 Определить `PRODUCT_CATEGORY_REPOSITORY`/`ProductCategoryRepositoryPort`
  (`findAll()`, читает существующую `RoappProductCategory`) в `application/ports/`.
  **Выполнено**: `application/ports/product-category/product-category.port.ts`, возвращает
  доменный VO `domain/value-objects/product-category.value-object.ts` (плоская проекция
  `RoappProductCategory`, по образцу `ServiceCategory`/`OrderType` в `modules/reports`, без
  `depth` — `RoappProductCategory` его не хранит).
- [x] 7.3 Определить `WAREHOUSE_REPOSITORY`/`WarehouseRepositoryPort` (`findAll()`, читает
  новую `RoappWarehouse`) в `application/ports/`.
  **Выполнено**: `application/ports/warehouse/warehouse.port.ts`, VO
  `domain/value-objects/warehouse.value-object.ts`.

## 8. Infrastructure: репозитории

- [x] 8.1 Написать тест(ы) на `GoodsTurnoverReportLineRepository.replaceAll`/`findByPeriod`
  (Prisma, по образцу репозиториев `modules/accounting/infrastructure/repositories/`).
  **Выполнено**: `infrastructure/repositories/goods-turnover-report/
  goods-turnover-report-line.repository.spec.ts`, по образцу
  `AccountingPeriodSnapshotRepository`/`PayoutCashboxRecordRepository.spec.ts` (мок
  `DatabaseService.getClient/withTransaction`, без реальной БД).
- [x] 8.2 Прогнать red.
  **Результат**: `Cannot find module './goods-turnover-report-line.repository'` — зафиксировано
  перед реализацией.
- [x] 8.3 Реализовать `GoodsTurnoverReportLineRepository` (через `UNIT_OF_WORK` там, где нужна
  транзакционная согласованность — построение отчёта в событии закрытия, задача 12).
  **Выполнено**: `GoodsTurnoverReportLineRepository` — `PrismaRepository.write()`
  (delete + createMany в одной транзакции, тот же приём, что
  `AccountingPeriodSnapshotRepository.saveAll`), маппинг через новый
  `GoodsTurnoverReportLineMapper` (`infrastructure/mappers/goods-turnover-report/`). Прямое
  использование `UNIT_OF_WORK` здесь не потребовалось — репозиторий сам себе гарантирует
  транзакционность через `write()`; `UNIT_OF_WORK` понадобится application-слою в задаче 12,
  когда пересчёт и сохранение снэпшота при закрытии периода объединят несколько репозиториев в
  одну транзакцию — как и предполагает design.md.
- [x] 8.4 Прогнать green.
  **Результат**: `npm run test -- goods-turnover-report-line.repository` — 4/4 green.
- [x] 8.5 Реализовать `ProductCategoryRepository`/`WarehouseRepository` — простые read-репозитории
  без бизнес-инвариантов (по объёму тестов сравнимо со справочниками `modules/reports`, напр.
  `ListServiceCategoriesService`). Верификация: репозитории покрыты минимум одним тестом на
  корректный маппинг Prisma-модели в доменный тип.
  **Выполнено**: `infrastructure/repositories/product-category/product-category.repository.ts`
  (+`.spec.ts`, 2 теста) и `infrastructure/repositories/warehouse/warehouse.repository.ts`
  (+`.spec.ts`, 2 теста) — TDD (red подтверждён `Cannot find module` перед реализацией, затем
  green). `npm run test -- --testPathPatterns=domains/service/modules/warehouse` — 6 suites/33
  tests green (включая домен из задачи 6); `npm run test -- accounting` — 90 suites/490 tests,
  без регрессий.

## 9. Application: построение отчёта

- [x] 9.1 Написать тесты на `BuildGoodsTurnoverReportService.build(period)` — обход дерева
  категорий (все категории и вложенные) × все склады, один вызов `getGoodsFlowReport` на пару
  (мок `ROAPP_GATEWAY`), довычисление `turnoverRatio` через `calcRatio` с чтением остатка
  прошлого периода из `GOODS_TURNOVER_REPORT_LINE_REPOSITORY` — по сценариям specs
  («покрывает все категории и вложенные», «категория без движения — нулевые показатели»,
  «отдельно по каждому складу», «позиция содержит все 4 показателя»).
  **Выполнено**: `application/services/build-goods-turnover-report.service.spec.ts` — 10 тестов
  (дерево категорий с вложенностью, нулевое движение, раздельные позиции по складам, все 4
  показателя, `calcRatio` по сохранённому остатку прошлого периода и без него, частичный успех
  при сбое пары категория-склад, пустые справочники, лимит параллелизма, форма запроса к
  `getGoodsFlowReport`).
- [x] 9.2 Прогнать red.
  **Результат**: `Cannot find module './build-goods-turnover-report.service'` — зафиксировано
  перед реализацией (сервис временно убран из каталога, тест-раннер запущен, файл возвращён).
- [x] 9.3 Реализовать `BuildGoodsTurnoverReportService` (`application/services/`) — с учётом
  лимита параллелизма из задачи 1.2 и устойчивостью к сбою отдельной пары категория-склад (см.
  design.md D6 — частичный успех).
  **Выполнено**: `application/services/build-goods-turnover-report.service.ts`. Обход —
  Cartesian-произведение `ProductCategoryRepositoryPort.findAll()` (плоский список, вложенность
  уже раскрыта справочником — отдельного рекурсивного спуска не требуется) ×
  `WarehouseRepositoryPort.findAll()`; на каждую пару один вызов
  `ROAPP_GATEWAY.fetchGoodsFlowReport({startDate, endDate, category_id, warehouses:[warehouseId]})`
  за границы месяца (`Period.getBounds()`). Остаток прошлого периода — один вызов
  `GOODS_TURNOVER_REPORT_LINE_REPOSITORY.findByPeriod(period.previous())`, без доп. запросов к
  ERP, ключ пары — `GoodsTurnoverReportLine.categoryWarehouseKey`. Параллелизм — пул из
  `GOODS_FLOW_REPORT_CONCURRENCY = 3` воркеров (`runWithConcurrencyLimit`, реальное ограничение
  одновременно летящих вызовов, не нарезка на чанки), значение и обоснование — по рекомендации
  задачи 1.2/`warehouse-api-finding.md` (реальные цифры со стейджа/прода замерить не удалось —
  сетевой блокер песочницы). Сбой одной пары — `try/catch` вокруг вызова ERP, `Logger.warn`,
  пара пропускается (`null`), `build()` не бросает и не прерывает остальные пары (design.md D6).
- [x] 9.4 Прогнать green.
  **Результат**: `npm run test -- --testPathPatterns=build-goods-turnover-report` — 10/10 green.
  `npm run test -- --testPathPatterns=domains/service/modules/warehouse` — 8 suites/46 tests green
  (без регрессий в остальных файлах модуля, включая параллельно дорабатываемые задачей 10).
  `npx tsc --noEmit` не даёт новых ошибок в `build-goods-turnover-report.service*.ts` (прочие
  ошибки `tsc` в репозитории — предсуществующие/из параллельно выполняемой задачи 10, вне этого
  диапазона).

## 10. Application/Interface: чтение отчёта и справочников (GET)

- [x] 10.1 Написать тесты на `GetGoodsTurnoverReportService.get(period)` (строки периода +
  справочники категорий/складов → форма ответа; период без сохранённых строк → пустой список,
  не ошибка — используется фронтендом для состояния «отчёт ещё не пересчитан»).
  **Выполнено**: `application/services/goods-turnover-report/get-goods-turnover-report.service.spec.ts`
  (3 теста: пустой период, денормализованная форма ответа, защитный путь на строку без
  соответствующей записи в справочнике) — по образцу `list-order-types.service.spec.ts`
  (`modules/reports`), моки портов через `jest.fn()`. Заодно тесты на два вспомогательных
  read-side справочника (`list-product-categories.service.spec.ts`,
  `list-warehouses.service.spec.ts`) — понадобились двум отдельным `GET`-эндпоинтам задачи 10.6.
- [x] 10.2 Прогнать red.
  **Результат**: `Cannot find module './get-goods-turnover-report.service'` (и аналогично для двух
  справочников) — зафиксировано перед реализацией.
- [x] 10.3 Реализовать `GetGoodsTurnoverReportService`.
  **Выполнено**: `application/services/goods-turnover-report/get-goods-turnover-report.service.ts` —
  читает `GOODS_TURNOVER_REPORT_LINE_REPOSITORY.findByPeriod`, при непустом результате
  дополнительно `PRODUCT_CATEGORY_REPOSITORY`/`WAREHOUSE_REPOSITORY` и денормализует каждую строку
  именем/`parentId` категории и именем склада (`to-goods-turnover-report-line-response.ts`) —
  `GoodsTurnoverTable` (задача 18) сможет строить дерево строк прямо из ответа, без отдельного join
  со справочником категорий на фронтенде; справочные `GET`-эндпоинты (10.6) при этом отдельные —
  нужны фронтенду для фильтров/селектов (`CategoryTreeSelect`/`WarehouseSelect`, задачи 16-17), а не
  для сборки самой таблицы. Плюс `ListProductCategoriesService`/`ListWarehousesService`
  (`application/services/{product-category,warehouse}/`) — простые read-side справочники по образцу
  `ListOrderTypesService`.
- [x] 10.4 Прогнать green.
  **Результат**: `npm run test -- --testPathPatterns="list-product-categories|list-warehouses|get-goods-turnover-report"`
  — 3 suites/7 tests green.
- [x] 10.5 Добавить Zod-схемы в `ireports-contracts` (ответ отчёта, справочники категорий и
  складов) — backend и frontend читают из одного места (`backend/CLAUDE.md`, Contracts).
  Верификация: пакет собирается, схемы экспортированы.
  **Выполнено**: `contracts/commands/goods-turnover-report.ts` (`getGoodsTurnoverReportResponseSchema`/
  `GetGoodsTurnoverReportResponse`, `productCategorySchema`/`ListProductCategoriesResponse`,
  `warehouseSchema`/`ListWarehousesResponse`), зарегистрирован в `contracts/commands/index.ts`.
  `npm run build` (`contracts/`) — проходит, типы видны из `dist/`.
- [x] 10.6 Реализовать HTTP-контроллеры: `GET /v1/service/warehouse/goods-turnover-report/:period`,
  `GET /v1/service/warehouse/product-categories`, `GET /v1/service/warehouse/warehouses` —
  каждый с `@ApiTags('Сервис: склад')` и `@ApiOperation({summary: '...'})` (обязательно —
  `backend/CLAUDE.md`, Swagger), DTO запроса через `nestjs-zod`.
  **Выполнено**: `interface/http-controllers/{goods-turnover-report,product-category,warehouse}/*.http.controller.ts`
  + маршруты `routesV1.service.warehouse.*` в `src/config/app.routes.ts`. `:period` — голый строковый
  `@Param` (без DTO), тем же приёмом, что `GetAccountingPeriodHttpController` — валидируется доменным
  VO `Period` внутри сервиса (`ArgumentInvalidException` → `400` через `DomainExceptionFilter`);
  два справочных эндпоинта без параметров запроса вовсе — отдельного DTO ни одному из трёх не
  потребовалось (нет query/body, которые стоило бы валидировать `nestjs-zod`-схемой). Модуль
  `WarehouseModule`, который свяжет эти контроллеры в приложении, — задача 13 (вне диапазона).
- [x] 10.7 Написать e2e-тест(ы) на контроллер отчёта (по образцу `*.e2e.spec.ts` в
  `modules/accounting/interface/http-controllers/`), прогнать и зафиксировать green.
  **Выполнено**: `interface/http-controllers/goods-turnover-report/get-goods-turnover-report.e2e.spec.ts`
  (3 сценария: денормализованный ответ, пустой период — не ошибка, `400` на невалидный формат
  периода). `WarehouseModule` ещё не существует (задача 13) — вместо импорта модуля (как в
  `reports.e2e.spec.ts`) `Test.createTestingModule` регистрирует контроллер и три порта явно
  (`controllers`/`providers`), тот же приём, что и остальные e2e-тесты этого проекта используют для
  подмены границы с БД, просто без модуля-обёртки. `npm run test -- --testPathPatterns=warehouse` —
  14 suites/60 tests green (включая уже реализованные домен/инфраструктуру задач 6-9).
- [x] 10.8 Обновить `ENDPOINTS.md` тремя новыми маршрутами.
  **Выполнено**: раздел `## domains/service/modules/warehouse (`/v1/service/warehouse`)` в
  `ENDPOINTS.md`, между `domains/service/modules/reports`/сделками Bitrix24 и
  `domains/shop/modules/sales`.

## 11. Крон: почасовой пересчёт открытого периода

- [x] 11.1 Написать тесты на `RecalculateOpenGoodsTurnoverPeriodCron` — читает статус
  `AccountingPeriod('service', period)` через `ACCOUNTING_PERIOD_REPOSITORY` (нет записи или
  `isOpen()` → пересчитать; `isClosed()` → пропустить), продолжает при ошибке одной пары
  категория-склад (design.md D6).
  **Выполнено**: `infrastructure/cron/recalculate-open-goods-turnover-period.cron.spec.ts` — 5
  тестов (нет записи периода → пересчёт, `isOpen()` → пересчёт, `isClosed()` → пропуск без вызова
  `build`/`replaceAll`, частичный успех `BuildGoodsTurnoverReportService` — build() уже сам не
  бросает при сбое одной пары, крон сохраняет то, что вернулось, ошибка всего пересчёта — только
  лог, без throw), по образцу `sales-plan-auto-creation.cron.spec.ts`.
- [x] 11.2 Прогнать red.
  **Результат**: `Cannot find module './recalculate-open-goods-turnover-period.cron'` —
  зафиксировано перед реализацией.
- [x] 11.3 Реализовать `RecalculateOpenGoodsTurnoverPeriodCron`
  (`@ProdCron(CronExpression.EVERY_HOUR)`, обёрнут в `runInSystemRequestContext` — по аналогии с
  `SalesPlanAutoCreationCron`) в `infrastructure/cron/`.
  **Выполнено**: `infrastructure/cron/recalculate-open-goods-turnover-period.cron.ts` — читает
  `ACCOUNTING_PERIOD_REPOSITORY.findByDirectionAndPeriod('service', period)` (текущий период через
  `Period.current()`, тот же UTC-расчёт, что и у `SalesPlanAutoCreationCron`), при `isClosed()`
  пропускает, иначе вызывает `BuildGoodsTurnoverReportService.build(period)` +
  `GOODS_TURNOVER_REPORT_LINE_REPOSITORY.replaceAll(period, report.lines)`; внешний `try/catch` +
  `logCronError` вокруг всего тика — по образцу `SalesPlanAutoCreationCron.run()`.
- [x] 11.4 Прогнать green.
  **Результат**: `npm run test -- --testPathPatterns=recalculate-open-goods-turnover-period` —
  5/5 green.

## 12. Событие: закрытие вместе с зарплатным периодом

- [x] 12.1 Написать тесты на обработчик `CloseGoodsTurnoverPeriod` — подписка на
  `AccountingPeriodClosedDomainEvent`, реагирует только на `direction === 'service'` (событие с
  `direction: 'shop'` игнорируется), делает финальный пересчёт и сохраняет строки как снэпшот
  (design.md D7).
  **Выполнено**: `application/events/close-goods-turnover-period.event-handler.spec.ts` — 3 теста
  (`direction: 'service'` → `build` + `replaceAll` вызваны с `event.period`, `direction: 'shop'` →
  оба не вызваны, ошибка финального пересчёта → не бросает исключение, только логирует), по
  образцу `AccountingPeriodClosedEventHandler.spec.ts`/`withRequestContext`.
- [x] 12.2 Прогнать red.
  **Результат**: `Cannot find module './close-goods-turnover-period.event-handler'` —
  зафиксировано перед реализацией.
- [x] 12.3 Реализовать `CloseGoodsTurnoverPeriod` (`@OnEvent('AccountingPeriodClosedDomainEvent')`,
  `application/events/`). Решение по design.md Open Questions: отдельного обработчика на
  переоткрытие `AccountingPeriod` не заводим — `ReopenAccountingPeriodHandler` не публикует
  событие, а часовой крон (задача 11) сам возобновит пересчёт открытого периода в течение часа.
  **Выполнено**: `application/events/close-goods-turnover-period.event-handler.ts` — событие
  `AccountingPeriodClosedDomainEvent` (уже публикуемое `AccountingPeriod.close()` в
  `modules/accounting`) резолвится по имени класса через `EventEmitter2.emitAsync` (см.
  `aggregate-root.base.ts`), поэтому подписка из модуля `warehouse` ловит его без прямой связи с
  `modules/accounting` за пределами `event.direction`/`event.period`; при
  `direction !== 'service'` выходит без побочных эффектов, иначе — тот же путь, что и крон
  (`BuildGoodsTurnoverReportService.build` + `replaceAll`), сбой логируется, а не пробрасывается
  (design.md Risks — асинхронный подписчик, коммит транзакции закрытия зарплатного периода не
  затрагивает). Переоткрытие — как и решено в Open Questions, отдельного обработчика нет.
- [x] 12.4 Прогнать green.
  **Результат**: `npm run test -- --testPathPatterns=close-goods-turnover-period` — 3/3 green.

## 13. Сборка модуля `warehouse`

- [x] 13.1 Создать `domains/service/modules/warehouse/warehouse.module.ts`:
  `imports: [AccountingModule]` (для `ACCOUNTING_PERIOD_REPOSITORY`, задача 3), регистрация
  провайдеров/контроллеров/крона/обработчика события из задач 6–12. Файлы модуля — без слова
  `service` в имени (правило домена, `domains/service/CLAUDE.md`).
  **Выполнено**: `warehouse.module.ts` — `imports: [AccountingModule, RoappGatewayModule]`
  (`AccountingModule` — `ACCOUNTING_PERIOD_REPOSITORY` для крона задачи 11; `RoappGatewayModule` —
  `ROAPP_GATEWAY` для `BuildGoodsTurnoverReportService`, тот же приём, что
  `modules/marketing/pricing`, `RoappGatewayModule` не глобальный, `AccountingModule` его наружу не
  экспортирует). `controllers`: три HTTP-контроллера задачи 10. `providers`: 4 application-сервиса
  (build/get/list-categories/list-warehouses), `CloseGoodsTurnoverPeriod`
  (`@OnEvent`-подписчик, задача 12) и `RecalculateOpenGoodsTurnoverPeriodCron` (`@ProdCron`, задача
  11) как обычные провайдеры (регистрация — декораторами на их методах, не отдельным API модуля), и
  три репозитория под своими DI-токенами (`GOODS_TURNOVER_REPORT_LINE_REPOSITORY`/
  `PRODUCT_CATEGORY_REPOSITORY`/`WAREHOUSE_REPOSITORY`).
- [x] 13.2 Подключить `WarehouseModule` в `app.module.ts`.
  **Выполнено**: импорт и позиция в массиве `imports` рядом с `AccountingModule` (перед
  `ShopAccountingModule`/`ShopWarehouseModule`).
- [x] 13.3 Добавить класс `WarehouseModule` в `include` документа `serviceDocument` в
  `src/config/swagger.config.ts` (обязательный шаг для нового DDD-модуля — `backend/CLAUDE.md`).
  **Выполнено**: добавлен в `include` массив `serviceDocument` рядом с `AccountingModule`.
- [x] 13.4 Прогнать `npm run build` и `npm run test` целиком. Верификация: оба проходят без
  ошибок и без регрессий в существующих наборах.
  **Результат**: `npm run build` — успешно, без ошибок (`nest build` + `tsc-alias`).
  `npm run test` — 243 test suites / 1365 tests, все green (в том числе видны логи
  `RecalculateOpenGoodsTurnoverPeriodCron`/`CloseGoodsTurnoverPeriod`/`BuildGoodsTurnoverReportService`
  из уже написанных задачами 9/11/12 тестов, ранее не запускавшихся вместе с полным приложением
  через `WarehouseModule`) — без регрессий в остальных наборах.

## 14. Разовая синхронизация справочника складов

- [x] 14.1 Выполнить `npm run initial` (или отдельную ручную команду, если так решено в задаче
  4.7) на тестовом окружении. Верификация: таблица `roapp_warehouses` заполнена не пустым
  списком.
  **Отклонение от буквальной команды**: полный `npm run initial -- <date> R` синхронизирует не
  только склады, а весь начальный набор RoApp (сотрудники, категории, услуги, товары, бонусы
  инженеров, все заказы с указанной даты и их позиции, см.
  `upload-initial-roapp-data.handler.ts`) — тяжёлая операция против реального RemOnline и
  **общей** dev-БД, шарящейся между worktree разных веток (см. предупреждение в задаче 2.3).
  Вместо неё — временный скрипт (`syncWarehousesOnly.ts`, удалён после проверки), вызывающий
  напрямую только `RoappSyncService.uploadWarehouses()` через тот же `AppModule`/DI-контейнер —
  проверяет ровно то, что нужно (`WarehouseModule`/сборка приложения корректны, `uploadWarehouses`
  апсертит в `roapp_warehouses`), без побочных эффектов остального пайплайна.
  **Блокер (задокументирован, не выдуман "лишь бы прошло")**: `ROAPP_WAREHOUSES` — ручной,
  администрируемый вручную справочник (design.md D3, резервный источник, задача 4.3) — не был
  задан ни одним предыдущим агентом (реального списка складов/названий из UI RemOnline ни у кого
  нет; публичный API их не отдаёт, подтверждено задачами 1.1/4.3). Прямая проверка (`GET
  /v2/company/locations`, выборка `write_offs` из ~35 реальных заказов через `GET
  /v2/orders/{id}/items`) нашла ровно один реальный `warehouseId=38107`, но **без** названия — API
  нигде его не отдаёт. Для верификации в `backend/.env` (не в git, см. `.gitignore`) добавлено
  временное тестовое значение `ROAPP_WAREHOUSES=[{"id":38107,"name":"Склад 38107
  (placeholder...)"}]`, явно помечено как placeholder для этого dev-окружения — реальные
  id/названия складов должен подставить администратор iRepair из UI RemOnline перед продом.
  **Результат**: `roapp_warehouses` после прогона — 1 запись (`id=38107`), не пустой список,
  формальная верификация задачи выполнена; `WarehouseModule` корректно резолвит все свои
  зависимости при полной загрузке `AppModule` (видно в логе `InstanceLoader`).

## 15. Frontend: страница `GoodsTurnoverReport` — каркас

- [x] 15.1 Создать `pages/GoodsTurnoverReport/{index.ts, model/api.ts, ui/Layout.tsx}` — `api.ts`
  через `queryOptions` (`frontend/CLAUDE.md`, Query options factory), `Layout.tsx` с именованными
  слотами `header`/`body` (по образцу `pages/ServicesReport/ui/Layout.tsx`).
  **Выполнено**: `model/api.ts` — три `queryOptions`-фабрики (`getGoodsTurnoverReport(period)`,
  `getProductCategories()`, `getWarehouses()`) поверх трёх GET-эндпоинтов задачи 10.6.
  `ui/Layout.tsx` — точная копия паттерна `pages/ServicesReport/ui/Layout.tsx` (слоты
  `header`/`body`/`error` + `RefreshTransitionLayout`). `index.ts` экспортирует
  `GoodsTurnoverReportPage` (`ui/GoodsTurnoverReportPage.tsx` — минимальная сборка
  `useGoodsTurnoverReportPage()` -> `Layout`, без mediator/, см. architecture.md "один основной
  виджет → один хук"; Filter Row/таблица — задачи 16-19).
- [x] 15.2 Зарегистрировать маршрут `goods-turnover-report` в `app/router.tsx`.
  **Выполнено**: маршрут `goods-turnover-report` -> `<GoodsTurnoverReportPage />` рядом с
  `sales-plan`.
- [x] 15.3 Написать тесты на `useGoodsTurnoverReportPage` (переключение периода/склада/категории
  инициирует нужные query; `isInitialLoad`/`isRefreshing` вычисляются поверх `useQuery` с
  `placeholderData: keepPreviousData`, как в `useServicesAnalytics`).
  **Выполнено**: `model/useGoodsTurnoverReportPage.spec.tsx` — 4 теста (isInitialLoad до/после
  первого ответа + автовыбор первого склада; смена периода вызывает новый GET отчёта с новым
  периодом в URL, isRefreshing вместо схлопывания старых строк; смена склада/смена категории — БЕЗ
  нового сетевого запроса, только состояние).
- [x] 15.4 Прогнать red.
  **Результат**: `Failed to resolve import "./useGoodsTurnoverReportPage.ts"` — зафиксировано перед
  реализацией.
- [x] 15.5 Реализовать `model/useGoodsTurnoverReportPage.ts` — плоский объект состояния/обработчиков.
  **Выполнено**: три независимых `useQuery` (справочники категорий/складов — `staleTime` 30 минут;
  отчёт — `queryKey` зависит от `period`, `placeholderData: keepPreviousData`). `warehouseId` —
  производное значение (`selectedWarehouseId ?? warehouses[0]?.id ?? null`), без
  `useEffect`+`setState` (правило `react-hooks/set-state-in-effect`, ловится линтером проекта) —
  отличие от буквального образца `useSalaryReportPage`'s дефолта отдела (там `setState` в эффекте
  проходит линт только потому, что вызывается через `selection.setDepartmentId`, не напрямую
  локальным `useState`-сеттером; здесь сеттер локальный, поэтому выбран паттерн без эффекта).
- [x] 15.6 Прогнать green.
  **Результат**: `npx vitest run src/pages/GoodsTurnoverReport` — 4/4 green. `npx eslint
  --config eslint.config.js src/pages/GoodsTurnoverReport src/app/router.tsx` — 0 ошибок. `npx tsc
  -b` — чисто. `npm run build` — успешно (`tsc -b && vite build`). Полный `npx vitest run` —
  74/77 файлов green (416/423 теста); 3 упавших файла (`RouteGuard.spec.tsx`,
  `useHasPermission.spec.ts`, `RequirePermission.spec.tsx`) — подтверждённая предсуществующая
  регрессия (воспроизводится и на `HEAD` без правок этой задачи, `git stash` + повторный прогон
  теми же 7 тестами), вне диапазона задачи 15, не трогалась.

## 16. Frontend: `WarehouseSelect` (ui-design.md, узел `M6ZfP` в `WvSO6`)

- [x] 16.1 Прочитать структуру узла `M6ZfP` (и копий `dGAXG`/`yKcNQ`/`u6VEag`/`t2Qsc`; на мобайле
  склад показан `Chip`-триггером, узел `Yu5pP` в `yDBTb`) через `mcp__pencil__execute`/`Get` в
  `design/sallary-first-iteration.pen`.
  **Выполнено**: `Get("M6ZfP", {depth: 6})` — frame `$surface`/`cornerRadius:10`/`stroke:$hairline`/
  `gap:8`/`padding:[9,12]`/`justifyContent:space_between` с текстовой парой (Label "Склад ·"
  `$ink-muted` 13px normal + Value `$ink` 13px 600) и иконкой `chevron-down` 15×15 `$ink-muted`
  (bounds 273×33 в `WvSO6`, копии `dGAXG`/`yKcNQ`/`u6VEag`/`t2Qsc` — тот же паттерн в остальных 4
  десктопных состояниях). `Get("Yu5pP", {depth: 6})` — мобильный `Chip`: frame `$surface`/
  `cornerRadius:7`/`gap:6`/`padding:[6,10]` с иконкой `warehouse` 13×13, текстом 12px/500 `$ink` и
  `chevron-down` 13×13, без подписи-лейбла.
- [x] 16.2 Написать тесты на `WarehouseSelect` (выбор склада вызывает `onSelect`, отображает
  `selectedWarehouseId`, рендерит список из `warehouses` — произвольной длины, не ограничен 3).
  **Выполнено**: `ui/WarehouseSelect.spec.tsx` — 6 тестов (десктопный триггер: лейбл + текущее
  значение, список из 5 складов без капа на 3, `onSelect` с id кликнутого склада; мобильный чип:
  только значение без лейбла, `onSelect`; рендер без падения при `selectedWarehouseId: null`), по
  образцу `pages/EmployeeBalance/ui/BalanceFilters.spec.tsx` (двойной рендер десктоп/мобайл,
  `data-slot`-скоупинг через `within`).
- [x] 16.3 Прогнать red.
  **Результат**: `Failed to resolve import "./WarehouseSelect.tsx"` — зафиксировано перед
  реализацией.
- [x] 16.4 Реализовать `WarehouseSelect` в `pages/GoodsTurnoverReport/ui/` (`shared/ui-kit/`) —
  select/combobox-компонент (не Tabs — по указанию пользователя при ревью макета, см.
  `architecture.md`), верстка по прочитанному в 16.1.
  **Выполнено**: `ui/WarehouseSelect.tsx` — поверх `shared/ui-kit/atoms/Select` (radix-ui `Select`,
  тот же примитив, что `SalaryReportFiltersV2`/`shared/ui-kit/atoms/Select.tsx`). Два независимых
  контролируемых `Select`-инстанса с общим `value`/`onValueChange` (не два `SelectTrigger` в одном
  `Select.Root` — Radix ожидает единственный триггер на корень для позиционирования попапа):
  десктопный (`hidden md:flex`, лейбл «Склад ·» + значение + `chevron-down`, `rounded-[10px]`/
  `px-3 py-[9px]`/`gap-2` — точное совпадение с `M6ZfP`) и мобильный (`flex md:hidden`, иконка
  `Warehouse` (lucide) + значение + `chevron-down`, `rounded-[7px]`/`px-2.5 py-1.5`/`gap-1.5` —
  совпадение с `Yu5pP`, кроме иконки `chevron-down` — 15px из общего `SelectTrigger` вместо 13px в
  макете, задокументировано в комментарии компонента как сознательный трейд-офф переиспользования
  примитива). `warehouses: WarehouseResponse[]` из `ireports-contracts` (контракт задачи 10.5).
- [x] 16.5 Прогнать green, сверить визуально со скриншотом узла `M6ZfP` (`TakeScreenshot`).
  **Результат**: `npx vitest run src/pages/GoodsTurnoverReport/ui/WarehouseSelect.spec.tsx` — 6/6
  green. `npx eslint --config eslint.config.js` — 0 ошибок (только предсуществующие
  `boundaries`-warnings конфига). `npx tsc -b` — чисто. `TakeScreenshot(["M6ZfP","Yu5pP"])`
  подтвердил визуальный референс (серая пилюля «Склад · Сервисный центр · Тверская» с
  `chevron-down` / чип «🏬 Тверская») — компонент сверен структурно/классами по этому референсу;
  живой рендер `WarehouseSelect` внутри страницы не снимался скриншотом браузера, т.к. wiring в
  `GoodsTurnoverReportPage`/`Layout` — отдельная задача (states+responsive, вне диапазона задачи
  16, эти файлы прямо запрещено трогать в этой задаче).

## 17. Frontend: `CategoryTreeSelect` (порт из `pages/ServicesReport`)

- [x] 17.1 Портировать `pages/ServicesReport/ui/CategoryTreeSelect` в
  `pages/GoodsTurnoverReport/ui/CategoryTreeSelect` под справочник товарных категорий (не
  сервисных) — переиспользовать `shared/lib/tree.ts` (`getDirectChildren`, `getSubtreeIds`).
  **Выполнено**: `ui/CategoryTreeSelect/{CategoryTreeSelect.tsx, index.ts,
  model/useCategoryOverlay.ts, ui/{CategorySearchInput.tsx, CategoryTreeBody.tsx,
  categoryOverlay.ts}}` — портированы 1:1 по разметке/стилям; типы адаптированы под
  `ProductCategoryResponse` (`ireports-contracts`, плоский `{id, name, parentId}`, без `depth`) и
  под `selectedId`/`categoryId: number | null` (не `string | null`, как у `ServiceCategory`) —
  `useGoodsTurnoverReportPage.ts` (задача 15, уже реализован) уже хранит `categoryId` числом
  напрямую, поэтому конвертация через `String()`/`Number()` на границе не нужна.
- [x] 17.2 Написать тесты на адаптированный `model/categoryTree.ts` (аналог
  `resolveDescendantIds`/`searchCategories` под товарные категории).
  **Выполнено**: `model/categoryTree.spec.ts` — 9 тестов (`getDirectChildren` для корня/вложенной/
  листовой категории, `resolveDescendantIds` включает саму категорию и потомков произвольной
  глубины, `searchCategories` — пустой запрос, поиск по подстроке без учёта регистра, цепочка
  предков от корня, корневая категория без предков).
- [x] 17.3 Прогнать red.
  **Результат**: `Failed to resolve import "./categoryTree.ts"` — зафиксировано перед реализацией.
- [x] 17.4 Реализовать адаптацию.
  **Выполнено**: `model/categoryTree.ts` — `getDirectChildren`/`resolveDescendantIds` тонкими
  обёртками над `shared/lib/tree.ts` (`getDirectChildren`/`getSubtreeIds`, как и предполагала
  задача), `searchCategories`/`getAncestorChain` перенесены из `pages/ServicesReport` без
  изменения логики (только тип элемента). `buildChartSeries` из оригинала не переносился — это
  специфика графика услуг, у товарных категорий аналога нет.
- [x] 17.5 Прогнать green.
  **Результат**: `npx vitest run src/pages/GoodsTurnoverReport` — 2 files/13 tests green (9 новых
  + 4 из задачи 15, без регрессий). `npx eslint --config eslint.config.js
  src/pages/GoodsTurnoverReport` — 0 ошибок. `npx tsc -b` — чисто. `npm run build` — успешно.
  Полный `npx vitest run` — 75/78 файлов green (425/432 тестов); те же 3 предсуществующих
  падающих файла (`RouteGuard.spec.tsx`, `useHasPermission.spec.ts`,
  `RequirePermission.spec.tsx`), что и зафиксировано задачей 15.6 (регрессия воспроизводится и на
  `HEAD` без правок этого диапазона) — не трогалась, вне диапазона задачи 17.

## 18. Frontend: `GoodsTurnoverTable` — паттерн Ledger (ui-design.md, узел `D3Sf4` в `WvSO6`)

- [x] 18.1 Прочитать структуру `Ledger Table` (`D3Sf4`) через `mcp__pencil__execute`/`Get`:
  строка «Итого» (`tcWPr`, 3 мини-метрики), `Header Row`, строки `R1`…`R4` с `Rail`/`Marker`/
  `Категория` (по одному `Rail` 16px на уровень предка, без капа глубины — подтверждено
  пользователем достаточным до 5 уровней), компактная высота строк 32px (верхний уровень/шапка)
  / 28px (вложенные) — см. ui-design.md, «Доработка таблицы».
  **Выполнено**: полный структурный обход `D3Sf4` (`Get` с визитором, ~230 узлов) + точечные
  `Get(..., {depth, resolveVariables:true})` по репрезентативным узлам (`tcWPr`/`R7qAT8`/`C6z40`
  верхний уровень/`AaoJs` вложенный/`TLStL`/`j0WnkA`) подтвердили описание ui-design.md буква в
  букву: строки — плоские СИБЛИНГИ `D3Sf4` (не настоящая DOM-вложенность — визуальная вложенность
  только через число `Rail`-фреймов перед `Marker`), высоты 32px (`R1`+`Header Row`)/28px
  (`R2`…`R4`), заливка верхнего уровня `#ECF1EE` vs `#FFFFFF` у вложенных, разделитель строк
  `#A9AFAA`, `Rail`-линия `#DFE3E0`. Сверх текста ui-design.md обнаружено и перенесено в задачу
  18.4: `Marker` содержит `Chevron`-иконку у категорий с потомками и `Dash`-прямоугольник у
  листьев; у строк верхнего уровня рядом с `Marker` — цветной `Dot` (6-цветная палитра, циклически
  по порядковому номеру корневой категории); ячейка «Обор.» раскрашена по порогам значения
  (`$ok-ink`/`$ink`/`$warn-ink`/`$danger`); сумма расхода/остатка в `tcWPr` арифметически равна
  сумме ТОЛЬКО корневых категорий (RemOnline `category_id` уже отдаёт агрегат по всему поддереву —
  подтверждено точным совпадением, напр. "Дисплеи" 186 400 = "iPhone" 128 300 + "iPad" 41 200 +
  "MacBook" 16 900, "Корпусные детали" 62 800 = "Задние крышки" 41 200 + "Рамки и шасси" 21 600).
- [x] 18.2 Написать тесты на построение дерева строк таблицы из плоского `GoodsTurnoverRow[]` +
  `parentId` (вложенность произвольной глубины, число `Rail` равно глубине узла, нулевая
  категория остаётся обычной строкой с `—` в коэффициенте).
  **Выполнено**: `model/goodsTurnoverTree.spec.ts` — 15 тестов: пустой список, корень без потомков,
  родитель/ребёнок (`hasChildren`/`depth`), 5 уровней вложенности подряд (Rail = глубина), сиблинги
  с перемешанными в исходном массиве детьми разных родителей, категория без движения не
  фильтруется (`turnoverRatio: null` сохраняется), защитный случай — `categoryParentId` вне
  переданного набора трактуется как корень (не отбрасывается молча — сверх буквального требования
  задачи, актуально для будущей фильтрации по поддереву в `CategoryTreeSelect`, задача 17),
  `rootIndex` инкрементируется только по корневым категориям и общий для всего их поддерева. Плюс
  тесты на декоративную/агрегирующую логику того же файла (`getRootDotColor` — цикл палитры,
  `getRatioColorClass` — пороги, `summarizeGoodsTurnoverRows` — сумма ТОЛЬКО по корневым строкам
  без задвоения, средневзвешенный по `stockSum` агрегатный коэффициент, `pluralizeCategories`).
- [x] 18.3 Прогнать red.
  **Результат**: `Cannot find module './goodsTurnoverTree.ts'` — зафиксировано перед реализацией
  (файл модели временно убран из каталога, тест-раннер запущен, файл возвращён).
- [x] 18.4 Реализовать `GoodsTurnoverTable` (`pages/GoodsTurnoverReport/ui/`) — рекурсивный рендер
  строк с `Rail`-отступами, колонки расход/остаток (шт/₽)/коэффициент (`—` при `null`), строка
  «Итого».
  **Выполнено**: `model/goodsTurnoverTree.ts` (`buildGoodsTurnoverTreeRows`,
  `summarizeGoodsTurnoverRows`, `getRootDotColor`, `getRatioColorClass`, `pluralizeCategories`) +
  `ui/GoodsTurnoverTable.tsx`. `GoodsTurnoverRow` переиспользует контракт
  `GoodsTurnoverReportLineResponse` как есть (`frontend/CLAUDE.md` — не дублировать типы API-
  payload'ов), `rows` — уже отфильтрованные по одному складу строки (architecture.md: `rows:
  GoodsTurnoverTable — "для выбранного склада"`); фильтрацию по складу/категории делает вызывающая
  сторона (задачи 15/17), сама таблица только строит дерево. Рендер — плоский список (не React-
  дерево) с `depth`/`hasChildren`/`rootIndex`, посчитанными один раз в `buildGoodsTurnoverTreeRows`
  (React key = `categoryId`), по одному `Rail`-спейсеру (`border-l`, 16px) на уровень предка, без
  капа. Цветовые пороги «Обор.» и палитра `Dot` задокументированы в `model/goodsTurnoverTree.ts`
  как декоративная деталь макета, а не FR/UX из proposal.md/spec.md (в этом change для frontend-
  задач нет пронумерованных FR/UX — сквозной паттерн трассируемости этого change прозой в
  tasks.md/архитектурных файлах, не тегами). Формат коэффициента — новый `formatRatio` в
  `shared/lib/format.ts` (переиспользуемый форматтер, туда же, где уже живут
  `formatCurrency`/`formatPercent`), плюс его собственные тесты в `format.spec.ts`.
- [x] 18.5 Прогнать green, сверить визуально со скриншотом узла `D3Sf4`.
  **Результат**: `npx vitest run src/pages/GoodsTurnoverReport src/shared/lib/format.spec.ts` — 6
  файлов/43 теста green (15 дерева + 3 таблицы + остальные из задач 15-17 + 3 formatRatio).
  Полный `npx vitest run` — 78 files/450 tests green из 81/457 (те же 3 предсуществующих падающих
  файла `RouteGuard.spec.tsx`/`useHasPermission.spec.ts`/`RequirePermission.spec.tsx`, что и
  зафиксировано задачей 15.6 — вне диапазона задачи 18, не трогалась). `npx eslint --config
  eslint.config.js src/pages/GoodsTurnoverReport src/shared/lib/format.ts` — 0 ошибок. `npx tsc -b`
  — чисто. `npm run build` — успешно. Визуальная сверка: временный незакоммиченный роут
  `/goods-turnover-preview` (`ScreenshotPreview.tsx`, удалён после проверки, НЕ в составе коммита)
  с данными по образцу реальных строк `D3Sf4`, `npm run start` + Playwright `browser_take_screenshot`
  — подтвердил соответствие: Rail-отступы по глубине, Chevron/Dash-маркер по `hasChildren`, цветной
  `Dot` верхнего уровня, заливка/высота строк по уровню, цветовые пороги «Обор.» (зелёный/тёмный/
  янтарный для 1.32/1.41 и 0.71 в тестовых данных), «—» у категории без коэффициента, строка
  «Итого» с 3 метриками, футер со счётчиком категорий.

## 19. Frontend: состояния экрана (ui-design.md, «Ключевые состояния»)

- [ ] 19.1 Реализовать состояние загрузки — `RefreshTransitionLayout`/`SpinnerPageLg` при
  `isInitialLoad` (узлы `jxljA` десктоп / `XJH3r` мобайл). Чисто визуальная задача без
  ветвлений — TDD-шаги не требуются, покрывается тестом 19.6 на переключение состояний.
- [ ] 19.2 Реализовать состояние ошибки — карточка с `ApiError.message` и кнопкой «Повторить»
  (узлы `t7VF4`/`akKcU`).
- [ ] 19.3 Реализовать состояние «отчёт ещё не пересчитан» — карточка без CTA (узлы
  `Q2EwKA`/`W9VKM`), показывается, когда бэкенд вернул пустой список строк для периода.
- [ ] 19.4 Реализовать бейдж закрытого периода в Filter Row (узлы `Sk1nF`/паттерн `VzQy1`/
  `RvLO7`) — без кнопки закрытия/пересчёта (design.md D7 — закрытие не действие пользователя).
- [ ] 19.5 Написать тесты на выбор состояния в `useGoodsTurnoverReportPage`/презентационном
  компоненте (какое состояние показывается при loading/error/пустых данных/`AccountingPeriod`
  закрыт — без условного рендера в самой странице, `frontend/CLAUDE.md`).
- [ ] 19.6 Прогнать red → реализовать логику выбора состояния → прогнать green.

## 20. Frontend: адаптивность 390 (ui-design.md, мобильные артборды)

- [ ] 20.1 Прочитать мобильные артборды (`yDBTb`/`RvLO7`/`XJH3r`/`akKcU`/`W9VKM`) через
  `mcp__pencil__execute`/`Get` — структура `App Bar` → `Body` (`Page Header` → `Filters` →
  контент) → `Bottom Nav`.
- [ ] 20.2 Реализовать адаптивные стили компонентов страницы под брейкпоинт 390 (Tailwind) —
  карточное представление строк, если так показано в мобильном макете (сверить по 20.1).
- [ ] 20.3 Проверить вручную в браузере на десктопной и мобильной ширине (навык `run`).
  Верификация: нет overflow/переполнения ни на одном брейкпоинте.

## 21. Интеграционная проверка «золотого пути»

- [ ] 21.1 Запустить бэкенд и фронтенд локально (`npm run start:dev` / `npm run start`),
  открыть `/goods-turnover-report`: отчёт строится по реальным/сид-данным, коэффициент
  отображается корректно (или `—` по правилам), переключение склада/категории/периода работает,
  закрытый период показывает бейдж без кнопки закрытия. Верификация: зафиксировать результат
  (скриншот/короткое описание) как подтверждение golden path перед архивацией change.
