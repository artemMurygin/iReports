# Plan: Эндпоинт каталога склада магазина (модуль `warehouse`, сущность `catalog`)

**PRD** docs/shop-warehouse-catalog/prd-shop-warehouse-catalog.md
**Дата** 2026-08-12

## Фазы реализации

### Фаза 1: Модуль `warehouse` и сущность `catalog` — сквозной путь (Tracer Bullet)
**Цель** Рабочий GET-эндпоинт, отдающий дерево категорий магазина из уже синхронизированной таблицы `MoySkladProductFolder`, без авторизации — по тому же принципу, что и остальные внутренние эндпоинты `domains/shop`.
**Что затрагивает?** backend
**Задачи:**
- Добавить в `contracts` (`ireports-contracts`) Zod-схему ответа каталога — дерево категорий (`id`, `name`, `pathName`, `children`) — как единый источник формы данных для backend и будущего фронтенда.
- Создать модуль `warehouse` в `backend/src/domains/shop/modules` по слоистому DDD-паттерну (`domain`/`application`/`infrastructure`/`interface`, см. `backend/CLAUDE.md`) и зарегистрировать его в модуле домена `shop`.
- Реализовать сущность `catalog`: application-сервис, который строит дерево категорий из `MoySkladProductFolder` (`parentId`/`pathName`) через `DatabaseService`, по аналогии с уже существующим `ProductFolderTreeService`, но возвращающий полное дерево, а не список потомков одной ноды.
- Добавить HTTP GET-контроллер `catalog` (`interface/http-controllers`) с маршрутом в `config/app.routes.ts`, без гарда — по образцу `domains/shop/modules/accounting`/`sales`.
- Юнит-тесты application-сервиса (пустой справочник, несколько уровней вложенности, включая/исключая архивные категории — сверить поведение с `product-folder-tree.service.spec.ts`) и spec HTTP-контроллера.
**Когда готово** GET-запрос к новому маршруту возвращает дерево категорий (`parent`/`children`, не плоский список); все тесты фазы проходят.

### Фаза 2: Документация эндпоинта
**Цель** Закрыть оставшиеся критерии готовности PRD — маршрут виден и в `ENDPOINTS.md`, и в Swagger.
**Что затрагивает?** backend
**Задачи:**
- Добавить Swagger-декораторы над контроллером `catalog` (`@ApiTags`, `@ApiOperation`, `@ApiResponse` и т.п.) по образцу существующих HTTP-контроллеров проекта, чтобы эндпоинт и форма ответа отображались в Swagger UI.
- Добавить раздел `domains/shop/modules/warehouse` в `ENDPOINTS.md` с описанием маршрута и формата ответа (дерево категорий).
- E2e-тест полного HTTP-пути: реальный запрос к поднятому приложению на тестовых синхронизированных данных возвращает ожидаемое дерево.
**Когда готово** `ENDPOINTS.md` содержит новый маршрут; эндпоинт виден в Swagger с описанием; e2e-тест зелёный.
