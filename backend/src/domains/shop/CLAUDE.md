# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Домен **`shop`** — розничная продажа новой техники Apple и аксессуаров конечным клиентам (см.
[корневой CLAUDE.md](../../../../CLAUDE.md) и [backend/CLAUDE.md](../../../CLAUDE.md) для общей
картины и слоистого DDD-паттерна модулей). ERP-система направления — **МойСклад (MoySklad)**.

Это самый тонкий из трёх доменов: пока нет ни одного собственного HTTP-эндпоинта и ни одного
DDD-модуля с бизнес-логикой — только интеграция с ERP и фоновая синхронизация в локальную БД.

## Структура

```
domains/shop/
├── integrations/moySklad/  — обёртка над REST API МойСклад
├── sync/moySklad/           — cron-синхронизация MoySklad → локальная БД
└── modules/                  — пусто, зарезервировано под будущую бизнес-логику (аналитика по
                                 рознице и т.п.), как `opt`
```

### `integrations/moySklad`

`MoyskladService` (поверх `MoyskladHttpService`) — набор `fetch*`-методов к API МойСклад:
сотрудники, папки товаров (`productFolders`), товары, услуги, контрагенты (`counterparties`),
заказы покупателей (`customerOrders`), отгрузки (`demands`). Постраничные выборки (папки, товары,
услуги, отгрузки) отдаются как `AsyncGenerator<T[]>` с `PAGE_LIMIT = 1000` — тот же паттерн, что у
`roapp` в домене `service`, итерировать через `for await`.

В отличие от `service`, здесь **нет** абстракции вроде `roapp-gateway` — `MoySkladSyncService` и
`TODO/priceMonitoring` инжектят конкретный класс `MoyskladService` напрямую, не через порт/DI-токен.
Модуль не регистрирует ни одного `@Controller` (`controllers: []` в `moysklad.module.ts`) — данные
наружу отдаются только через `sync`, а не через собственный HTTP API. Если понадобится подменять
источник данных в тестах или добавить второй транспорт (аналогично `custom-api-roapp`), заведи порт
по образцу `service/integrations/roapp-gateway`, а не расширяй `MoyskladService` напрямую.

### `sync/moySklad` — синхронизация с ERP

`MoySkladSyncService` тянет данные и делает `upsert` в Prisma-таблицы `moySklad*`
(`prisma/schema/moySklad.prisma`). Как и в `service`, порядок важен: категории товаров —
топологическая сортировка родитель→потомок (`topoSortFolders`) перед upsert.

`extractIdFromHref` (`moysklad-sync.mappers.ts`) — сквозной хелпер: API МойСклад отдаёт связи
(сотрудник, контрагент, склад, статус...) как `{ meta: { href } }`, а не голым id, поэтому id
приходится вытаскивать из URL почти на каждом маппинге.

Основной объект синхронизации — **отгрузки (demands)**, ключевая сущность для аналитики продаж
магазина:

- `uploadDemand` пишет шапку отгрузки (`moySkladDemand`) и её позиции (`moySkladDemandPosition`) в
  одной Prisma-транзакции, предварительно удаляя старые позиции (`deleteMany` + `createMany`, не
  diff/upsert по позициям).
- `ONLINE_MANAGER_ATTR_ID` — id кастомного атрибута в МойСклад, которым размечен
  онлайн-менеджер отгрузки (в отличие от `owner` — offline-менеджера); без этого атрибута
  `onlineManagerId` будет `null`.
- **Товары-модификации (`variant`)** не приходят в `/entity/product` и никогда не будут докатаны
  обычным `uploadProducts()` — если позиция отгрузки ссылается на неизвестный `variant`, для него
  на лету создаётся placeholder-запись в `moySkladProduct`, **наследующая `folderId` от
  родительского товара** (см. комментарий в `uploadDemand`). Это осознанное решение: без
  унаследованной категории такой товар навсегда останется без `folderId` и будет выпадать из
  отчётов, отфильтрованных по категории — не убирать это наследование при рефакторинге.
- Услуги (`service`) в позициях отгрузки, которых ещё нет в `moySkladService`, создаются аналогично
  через `createMany({ skipDuplicates: true })`.

`MoySkladSyncCron` (`@ProdCron(CronExpression.EVERY_5_MINUTES)`) синкает через крон **только**
`uploadUpdatedDemands` — тот же паттерн `failedSince`-checkpoint при ошибке, что у `RoappSyncCron` в
домене `service` (см. `backend/src/domains/service/CLAUDE.md`). Остальные методы сервиса
(`uploadEmployees`, `uploadProductFolders`, `uploadProducts`, `uploadServices`) в крон не
включены — это ручные/разовые операции (`npm run initial`).

## Целевой набор модулей домена

`shop` и `service` — параллельные бизнес-направления с похожим набором бизнес-процессов, поэтому
итоговая структура `modules/` у них будет похожей, но бизнес-логика внутри каждого процесса разная
(разные ERP, разные правила) — это **не общий переиспользуемый код**, а зеркальный, но независимый
набор модулей в каждом домене (см. также `backend/src/domains/service/CLAUDE.md`, где `accounting`
и `sales` уже частично реализованы — для `shop` это ориентир по стилю, не код для переиспользования).
Для `shop`, где `modules/` пока пуст, планируются:

- **`accounting`** — бухгалтерия. Не существует.
- **`sales`** — продажи (заказы покупателей/отгрузки). Не существует.
- **`purchasing`** — закупки товара у поставщиков. Не существует.
- **`logistics`** — логистика (доставка товара, перемещения между складами/точками). Не существует.
- **`marketing`** — маркетинг (источники обращений, кампании и их эффективность). Не существует.
- **`warehouse`** — склад/остатки товаров. Не существует.

Именование модулей — короткое существительное на английском, без домена в названии (не
`shop-warehouse`): домен и так задаёт контекст через путь `domains/shop/modules/*`. Для "склада"
используем `warehouse`, а не `store` — `store` в этом проекте легко спутать с самим доменом `shop`
(розничный магазин), поэтому его в качестве имени модуля избегаем. Для "закупок" — `purchasing`, а
не `procurement`: короче и симметрично уже используемому в `service` `sales`.

## Функциональность домена, ещё не перенесённая в `domains/shop`

- **`TODO/priceMonitoring`**, эндпоинт `/price-monitoring/update-shop-products-costs` — обновляет
  себестоимость товаров в МойСклад (`moysklad.batchUpdateProducts`), сверяясь с прайсами поставщиков
  через Excel/AI-парсинг (`src/integrations/ai`). Этот же модуль обслуживает и домен `service`
  (`update-service-price`) — единая точка входа для обеих ERP, физически не принадлежит ни одному
  домену.
- Розничная аналитика (свой аналог `reports`/`sales` из домена `service`) для `shop` пока не
  существует ни в каком виде — `modules/` домена пуст. При появлении такого функционала заводить его
  по DDD-слоям (`domain`/`application`/`infrastructure`/`interface`), описанным в
  `backend/CLAUDE.md`, а не как плоский `TODO`-модуль.

## Данные и тесты

- Prisma-схема: `prisma/schema/moySklad.prisma`.
- Тест есть один: `integrations/moySklad/moysklad.service.spec.ts`. `sync/moySklad` тестами не
  покрыт.
