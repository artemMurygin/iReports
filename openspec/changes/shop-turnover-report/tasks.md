## 1. Prisma-схема

- [x] 1.1 Добавить в `moySklad.prisma` модели `MoySkladStore` (`id`, `name`) и `MoySkladStock`
  (`productId`, `warehouseId`, `quantity`, `costSum`, `snapshotAt`, уникальный индекс
  `(productId, warehouseId, snapshotAt)`, индекс по `snapshotAt`); добавить nullable-колонку
  `storeId` в `MoySkladDemand`. Верификация: `prisma validate` проходит, `prisma migrate dev`
  генерирует аддитивную миграцию без ошибок.
- [x] 1.2 Добавить модель `MoySkladTurnoverReportLine` (`period`, `categoryId`, `warehouseId`,
  `turnoverQuantity`, `turnoverSum`, `stockQuantity`, `stockSum`, уникальный индекс
  `(period, categoryId, warehouseId)`). Верификация: `prisma validate` + миграция применяется на
  тестовой БД.
- [x] 1.3 Добавить `SHOP_ACCOUNTING_PERIOD_REPOSITORY` в `exports` `ShopAccountingModule`.
  Верификация: существующие тесты `ShopAccountingModule` не ломаются; сборка backend проходит.

<!-- Чисто схемные изменения без ветвлений логики — TDD-шаги (red/green) не применимы, верификация
     через prisma validate/migrate и существующий тестовый набор модуля. -->

## 2. Domain — Value Objects (TDD)

- [x] 2.1 Написать тесты на `Money` (`domains/shop/modules/warehouse/domain/value-objects/
  money.value-object.ts`): создание из неотрицательного числа копеек, ошибка/исключение на
  отрицательное значение, сравнение по значению.
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red (класса ещё нет).
- [x] 2.3 Реализовать `Money` (наследник `ValueObject` из `src/shared/domain/`).
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать green, регрессий в соседних тестах нет.

- [x] 2.5 Написать тесты на `TurnoverCoefficient.calculate` (`domains/shop/modules/warehouse/
  domain/value-objects/turnover-coefficient.value-object.ts`) по D8/specs: обычный расчёт по
  формуле `turnoverSum / ((prevStockSum + currStockSum) / 2)`; `previousStockSum === null` →
  `isAvailable() === false` (не `0`); оба остатка нулевые → `isAvailable() === false` без деления
  на ноль.
- [x] 2.6 Прогнать тесты из 2.5 и зафиксировать red.
- [x] 2.7 Реализовать `TurnoverCoefficient`.
- [x] 2.8 Прогнать тесты из 2.5 и зафиксировать green, регрессий нет.

## 3. Domain — Aggregate `GoodsTurnoverReportLine` (TDD)

- [x] 3.1 Написать тесты на создание `GoodsTurnoverReportLine`: валидный `Period` (переиспользуется
  `src/shared/domain/period.value-object.ts`), неотрицательные `turnoverQuantity`/`stockQuantity`,
  обязательные `categoryId`/`warehouseId`.
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать red.
- [x] 3.3 Реализовать сущность `GoodsTurnoverReportLine` (наследник `Entity`/`AggregateRoot` из
  `src/shared/domain/`).
- [x] 3.4 Прогнать тесты из 3.1 и зафиксировать green, регрессий нет.

## 4. Application — порт и репозиторий отчёта (TDD)

- [x] 4.1 Написать тесты на `GOODS_TURNOVER_REPORT_REPOSITORY.replaceForPeriod`: полная замена
  строк периода в одной транзакции (старые строки периода удалены, новые записаны), строки других
  периодов не затронуты.
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать red.
- [x] 4.3 Реализовать порт (application/ports) и Prisma-репозиторий (infrastructure/repositories)
  через unit-of-work (`UNIT_OF_WORK`), включая `findByPeriod`.
- [x] 4.4 Прогнать тесты из 4.1 и зафиксировать green, регрессий нет.

## 5. Sync — справочник складов (D2, TDD)

- [x] 5.1 Написать тесты на `MoyskladService`-метод получения складов (`GET /entity/store`,
  постраничная выгрузка, по образцу существующих fetch-методов) — корректная пагинация, маппинг
  полей.
- [x] 5.2 Прогнать тесты из 5.1 и зафиксировать red.
- [x] 5.3 Реализовать метод получения складов + `MoySkladSyncService.uploadStores()` (апсерт в
  `MoySkladStore`) + подключить к существующему 5-минутному `MoySkladSyncCron` и к
  `UploadInitialMoySkladDataHandler`.
- [x] 5.4 Прогнать тесты из 5.1 и зафиксировать green, регрессий в существующих тестах синка нет.

## 6. Sync — `storeId` на `Demand` (D3, TDD)

- [x] 6.1 Написать тесты на апсерт `Demand` в `moysklad-sync.service.ts`: при наличии `store` в
  ответе МойСклад — `storeId` сохраняется; при отсутствии — остаётся `null`, апсерт не падает.
- [x] 6.2 Прогнать тесты из 6.1 и зафиксировать red (текущий маппинг поле отбрасывает).
- [x] 6.3 Дополнить маппинг апсерта `Demand` полем `storeId`.
- [x] 6.4 Прогнать тесты из 6.1 и зафиксировать green, регрессий в существующих тестах синка
  `Demand` (расчёт зарплаты) нет.

## 7. Sync — почасовой снимок остатков (D5, TDD)

- [x] 7.1 Написать тесты на `MoyskladService`-метод асинхронного отчёта об остатках
  (`GET /report/stock/bystore?async=true&groupBy=product`, без `limit`/`offset`): запуск задачи,
  опрос статуса до готовности, получение и парсинг итогового результата; обработка ошибки/таймаута
  опроса.
- [x] 7.2 Прогнать тесты из 7.1 и зафиксировать red.
- [x] 7.3 Реализовать метод (сверить контракт опроса асинхронной задачи МойСклад вручную перед
  реализацией — см. design.md «Открытые вопросы»; при недоступности/нестабильности — синхронный
  fallback с постраничной выгрузкой, см. design.md Risks).
- [x] 7.4 Прогнать тесты из 7.1 и зафиксировать green.

- [x] 7.5 Написать тесты на `MoySkladSyncService.uploadStockSnapshot()`: пишет новый набор строк
  `MoySkladStock` с общим `snapshotAt`, не перезаписывая (не трогая) строки предыдущих прогонов.
- [x] 7.6 Прогнать тесты из 7.5 и зафиксировать red.
- [x] 7.7 Реализовать `uploadStockSnapshot()` + новую крон-задачу `MoySkladStockSyncCron`
  (`@ProdCron(CronExpression.EVERY_HOUR)`, обёрнута в `runInSystemRequestContext`, по аналогии с
  `RoappSyncCron`/`SalesPlanAutoCreationCron`).
- [x] 7.8 Прогнать тесты из 7.5 и зафиксировать green, регрессий нет.

## 8. Sync — бэкфилл истории остатков (D5.1, TDD)

- [x] 8.1 Написать тесты на `MoyskladService`-метод легаси `GET /entity/assortment` с фильтром
  `stockMoment`/`stockStore`: корректный запрос фильтра на конец месяца для конкретного склада,
  парсинг остатка/себестоимости из ответа (сверить точные имена полей вручную перед реализацией —
  см. design.md «Открытые вопросы»).
- [x] 8.2 Прогнать тесты из 8.1 и зафиксировать red.
- [x] 8.3 Реализовать метод.
- [x] 8.4 Прогнать тесты из 8.1 и зафиксировать green.

- [x] 8.5 Написать тесты на `MoySkladSyncService.backfillHistoricalStockSnapshots(fromDate)`: для
  каждого месяца от `fromDate` до текущего и каждого склада пишет ровно один снимок
  `MoySkladStock` с `snapshotAt` = конец месяца; повторный запуск идемпотентен (upsert по
  `(productId, warehouseId, snapshotAt)`, не дублирует строки).
- [x] 8.6 Прогнать тесты из 8.5 и зафиксировать red.
- [x] 8.7 Реализовать метод; подключить его и `uploadStores()` в `UploadInitialMoySkladDataHandler`
  (`backend/src/domains/shop/sync/moySklad/application/command/
  upload-initial-moysklad-data.handler.ts`), вызываемый из `backend/src/scripts/
  initialUploadData.ts` (`npm run initial`/`npm run initialProd <date> M`).
- [x] 8.8 Прогнать тесты из 8.5 и зафиксировать green, регрессий в существующем
  `UploadInitialMoySkladDataHandler` (синк сотрудников/категорий/товаров/услуг/`Demand`) нет.

## 9. Application — построение отчёта (D4/D6/D7.2, TDD)

- [ ] 9.1 Написать тесты на `RebuildGoodsTurnoverReportService.rebuild(period)` по specs:
  — оборот считается только из `Demand`/`MoySkladDemandPosition.sum` (без `RetailDemand`, без
    учёта возвратов);
  — остаток берётся из снимка `MoySkladStock` с максимальным `snapshotAt`, не превышающим конец
    периода;
  — каждая категория дерева (включая вложенные) присутствует в результате, в том числе с нулями,
    если по ней не было ни оборота, ни остатка;
  — результат разбит по складам, без объединения;
  — повторный вызов для того же периода полностью заменяет прежние строки (не дублирует и не
    смешивает с предыдущим расчётом).
- [ ] 9.2 Прогнать тесты из 9.1 и зафиксировать red.
- [ ] 9.3 Реализовать `RebuildGoodsTurnoverReportService`, используя существующий
  `ProductFolderTreeService` (`domains/shop/sync/moySklad/product-folder-tree.service.ts`) для
  обхода дерева категорий и репозиторий из группы 4 для замены строк.
- [ ] 9.4 Прогнать тесты из 9.1 и зафиксировать green, регрессий нет.

## 10. Крон-задача пересчёта отчёта и закрытие периода (D9, TDD)

- [ ] 10.1 Написать тесты на `GoodsTurnoverReportCron`: вызывает пересчёт текущего открытого месяца,
  если `ShopAccountingPeriod` этого месяца не закрыт; пропускает пересчёт, если закрыт.
- [ ] 10.2 Прогнать тесты из 10.1 и зафиксировать red.
- [ ] 10.3 Реализовать `GoodsTurnoverReportCron` (`@ProdCron(EVERY_HOUR)`,
  `runInSystemRequestContext`), читающий статус через `SHOP_ACCOUNTING_PERIOD_REPOSITORY`
  (см. задачу 1.3).
- [ ] 10.4 Прогнать тесты из 10.1 и зафиксировать green.

- [ ] 10.5 Написать тесты на `GoodsTurnoverPeriodClosedHandler`: подписка на
  `ShopAccountingPeriodClosedDomainEvent` вызывает финальный пересчёт периода из события и
  фиксирует его как снэпшот (строки больше не меняются последующим часовым кроном, т.к. период уже
  закрыт).
- [ ] 10.6 Прогнать тесты из 10.5 и зафиксировать red.
- [ ] 10.7 Реализовать `GoodsTurnoverPeriodClosedHandler` (`@OnEvent('ShopAccountingPeriodClosedDomainEvent')`).
- [ ] 10.8 Прогнать тесты из 10.5 и зафиксировать green, регрессий в существующем обработчике
  закрытия периода `accounting` нет (несколько независимых подписчиков на одно событие).

## 11. Application — чтение отчёта (TDD)

- [ ] 11.1 Написать тесты на `GetGoodsTurnoverReportService.getReport(period, warehouseId?)`:
  читает строки текущего и предыдущего периода, считает `TurnoverCoefficient` по каждой строке,
  фильтрует по складу при указании `warehouseId`, маппит в DTO ответа.
- [ ] 11.2 Прогнать тесты из 11.1 и зафиксировать red.
- [ ] 11.3 Реализовать `GetGoodsTurnoverReportService` и маппер в DTO.
- [ ] 11.4 Прогнать тесты из 11.1 и зафиксировать green.

## 12. Contracts (`ireports-contracts`)

- [ ] 12.1 Добавить Zod-схемы `GoodsTurnoverReportLine`/`GoodsTurnoverReportResponse` (с
  `coefficient: number | null`) и `ShopStore` в `contracts/commands/` (по образцу
  `catalog.ts`/`sales-plan.ts`). Верификация: `tsc`/сборка `contracts` проходит, типы
  экспортируются из `ireports-contracts`.

## 13. HTTP-контроллеры (interface)

- [ ] 13.1 Написать e2e/контроллерный тест на `GET /v1/shop/warehouse/goods-turnover-report/:period`
  (успешный ответ по specs, включая случай отсутствующего предыдущего периода → `coefficient: null`
  в ответе, не `0`).
- [ ] 13.2 Прогнать тест из 13.1 и зафиксировать red.
- [ ] 13.3 Реализовать `GetGoodsTurnoverReportHttpController` (`@ApiTags('Магазин: склад')`,
  `@ApiOperation`, DTO через `createZodDto`), зарегистрировать модуль в `shopDocument` в
  `src/config/swagger.config.ts`, если ещё не зарегистрирован для `warehouse`.
- [ ] 13.4 Прогнать тест из 13.1 и зафиксировать green.

- [ ] 13.5 Написать e2e-тест на `GET /v1/shop/warehouse/stores`.
- [ ] 13.6 Прогнать тест из 13.5 и зафиксировать red.
- [ ] 13.7 Реализовать `GetShopStoresHttpController`.
- [ ] 13.8 Прогнать тест из 13.5 и зафиксировать green.
- [ ] 13.9 Обновить `ENDPOINTS.md` двумя новыми эндпоинтами.

## 14. Frontend — вынос переиспользуемой инфраструктуры (рефакторинг, без новой логики)

- [ ] 14.1 Перенести `getShopCatalog()` из `features/SalesPlan/model/api.ts` в
  `shared/api/shopCatalog.ts` (сохранив текущий `queryKey` для совместимости кэша); обновить импорт
  в `features/SalesPlan`. Верификация: существующие тесты/сборка `SalesPlan` проходят без
  изменений поведения — чистый перенос без ветвлений, отдельные TDD-шаги не нужны.
- [ ] 14.2 Перенести `PeriodPicker` и хелперы `formatPeriodLabel`/`shiftPeriod` из
  `features/SalesPlan/ui`/`model/format.ts` в `shared/ui-kit/molecules/PeriodPicker/`; обновить
  импорт в `features/SalesPlan`. Верификация: существующие сценарии `SalesPlan` с выбором периода
  визуально и функционально не изменились (ручная проверка/скриншот) — чистый перенос, без
  ветвлений, отдельные TDD-шаги не нужны.

## 15. Frontend — feature `GoodsTurnoverReport` (TDD для логики с ветвлениями)

- [ ] 15.1 Написать тесты на `model/api.ts` (`useGoodsTurnoverReport`, `useShopStores`):
  корректный `queryKey`/`queryFn`, ошибки сети оборачиваются в `ApiError` с читаемым сообщением.
- [ ] 15.2 Прогнать тесты из 15.1 и зафиксировать red.
- [ ] 15.3 Реализовать `features/GoodsTurnoverReport/model/api.ts` (queryOptions-фабрики) и
  `index.ts` (реэкспорт корневого UI-компонента).
- [ ] 15.4 Прогнать тесты из 15.1 и зафиксировать green.

## 16. Frontend — компоненты страницы (TDD для компонентов с логикой)

- [ ] 16.1 Написать тесты на `CategoryTreeTable`: построение дерева из каталога + строк отчёта
  через `shared/lib/tree.ts#buildTree` (категории без оборота/остатка отображаются с нулями, а не
  пропускаются — по specs), раскрытие/сворачивание узлов.
- [ ] 16.2 Прогнать тесты из 16.1 и зафиксировать red.
- [ ] 16.3 Реализовать `pages/GoodsTurnoverReport/ui/CategoryTreeTable/` (свой подмодуль
  `model`+`ui`).
- [ ] 16.4 Прогнать тесты из 16.1 и зафиксировать green.

- [ ] 16.5 Написать тесты на `CoefficientCell`: `coefficient === null` → отображается `—`, число →
  отформатированное значение.
- [ ] 16.6 Прогнать тесты из 16.5 и зафиксировать red.
- [ ] 16.7 Реализовать `CoefficientCell`.
- [ ] 16.8 Прогнать тесты из 16.5 и зафиксировать green.

- [ ] 16.9 Реализовать `WarehouseFilter` (простой select-обвязка над атомом `shared/ui-kit`, без
  собственных ветвлений логики — TDD-шаги не заводятся, обоснование: только проброс
  `value`/`onChange`).

## 17. Frontend — страница и роутинг

- [ ] 17.1 Написать тесты на `useGoodsTurnoverReportPage`: композиция периода/склада/данных отчёта,
  разделение `isInitialLoad`/`isRefreshing` (смена периода/склада не должна "схлопывать" уже
  отрисованное дерево — `placeholderData: keepPreviousData`).
- [ ] 17.2 Прогнать тесты из 17.1 и зафиксировать red.
- [ ] 17.3 Реализовать `pages/GoodsTurnoverReport/model/useGoodsTurnoverReportPage.ts` и
  `ui/GoodsTurnoverReportPage.tsx` (чистая склейка, без условного рендера).
- [ ] 17.4 Прогнать тесты из 17.1 и зафиксировать green.

- [ ] 17.5 Зарегистрировать маршрут страницы (`/shop/warehouse/goods-turnover-report` или принятый
  в проекте эквивалент) и пункт навигации в разделе «Магазин». Верификация: страница открывается по
  прямому URL и через навигацию.

## 18. Продакшен-раскатка (Migration Plan)

- [ ] 18.1 Применить Prisma-миграцию из группы 1 на продакшене.
- [ ] 18.2 Задеплоить код (группы 1–17).
- [ ] 18.3 Выполнить разовый `npm run initialProd <дата ~1 год назад> M` на продакшене; проверить,
  что: (а) исторические `Demand` получили `storeId`, (б) `MoySkladStore` заполнен, (в)
  `MoySkladStock` содержит по одному снимку на конец каждого прошлого месяца в запрошенном
  диапазоне.
- [ ] 18.4 Проверить, что `GET /v1/shop/warehouse/goods-turnover-report/:period` отдаёт корректные
  данные как для текущего открытого месяца, так и минимум для одного забэкфилленного прошлого
  месяца, и что коэффициент самого раннего забэкфилленного месяца — `null` (нет более раннего
  периода для сравнения, см. design.md D5.1/D8) — ожидаемое поведение, не дефект.
- [ ] 18.5 Убедиться, что обе новые почасовые крон-задачи (синк остатков, пересчёт отчёта) запущены
  и отрабатывают без ошибок в течение первого часа после раскатки.
