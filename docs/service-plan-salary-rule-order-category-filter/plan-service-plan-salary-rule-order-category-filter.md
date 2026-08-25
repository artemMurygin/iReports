# Plan: Учёт типов заказов в плане продаж сервиса и в зарплатных правилах

**PRD**: `docs/service-plan-salary-rule-order-category-filter/prd-service-plan-salary-rule-order-category-filter.md`
**Дата**: 2026-08-24

## Фазы реализации

### Фаза 1: Справочник типов заказов RoApp (tracer bullet)
**Цель**: Дать плану и правилам единый источник данных для выбора — read-side эндпоинт `GET /v1/service/reports/order-type` со списком типов заказов RoApp (человекочитаемые названия).
**Что затрагивает?** backend
**Задачи:**
- [ ] Порт + репозиторий чтения списка `RoappOrderType` из БД (id, name) — по образцу `ServiceSalesRepository.listCategories`/`ListServiceCategoriesService`.
- [ ] Контракт в `contracts/` — zod-схема ответа списка типов заказов.
- [ ] HTTP-контроллер `GET /v1/service/reports/order-type` с `@ApiTags`/`@ApiOperation`, тип ответа из `ireports-contracts`.
- [ ] Модуль контроллера добавлен в `include` `serviceDocument` (`src/config/swagger.config.ts`).
**Тесты:** unit-тест сервиса чтения списка (пустой справочник / несколько записей); e2e/контроллер-тест на сам эндпоинт.
**Когда готово**: `GET /v1/service/reports/order-type` отдаёт актуальный список `{id, name}[]` типов заказов из локальной БД; тесты зелёные.

### Фаза 2: Backend — план продаж учитывает выбранные типы заказов
**Цель**: План продаж хранит выбор типов заказов, факт и прогноз считаются только по заказам этих типов, автосоздание плана переносит выбор.
**Что затрагивает?** backend, database
**Задачи:**
- [ ] Поле выбора типов заказов на `SalesPlan`/`SalesPlanTemplate` (Prisma-модель + миграция; пусто/`null` = «все типы»).
- [ ] Entity/value-object/мапперы `SalesPlan`/`SalesPlanTemplate` и контракты create/update/template (`contracts/commands/sales-plan.ts`) с новым полем.
- [ ] `RoappSalesFactSourceRepository.aggregate` — источник `RoappOrder.orderTypeId` и фильтрация факта строки плана по её выбранным типам заказов.
- [ ] `EnsureSalesPlansForPeriodService` — перенос выбора типов заказов из плана предыдущего месяца, либо из шаблона плана, если плана предыдущего месяца нет.
- [ ] HTTP-контроллеры создания/обновления плана и шаблона принимают и отдают новое поле.
**Тесты:** unit на entity/value-object (валидация поля), unit на `RoappSalesFactSourceRepository`/`GetSalesPerformanceService` (факт с фильтром и без), unit на `EnsureSalesPlansForPeriodService` (перенос поля из предыдущего месяца/шаблона), e2e на create/update плана с полем.
**Когда готово**: план с указанными типами заказов отдаёт факт/прогноз только по заказам этих типов; план без указания — по всем; автосозданный план переносит выбор с предыдущего периода/шаблона; изменение поля не меняет снапшоты уже закрытых периодов; все тесты зелёные.

### Фаза 3: Backend — правила OrderPayed/ServiceCompleted учитывают выбранные типы заказов
**Цель**: Начисление по зарплатным правилам `OrderPayed` и `ServiceCompleted` можно ограничить типами заказов.
**Что затрагивает?** backend
**Задачи:**
- [ ] Поле выбора типов заказов в `OrderPayedSalaryConfig`/`ServiceCompletedSalaryConfig` (`salary-rule.types.ts`) и в контрактах (`contracts/commands/salary-rule.ts`), только для этих двух типов правил.
- [ ] `orderTypeId` в `OrderPayedErpItem`/`ServiceCompletedErpItem` и в запросах `ServiceCalculationDataRepository.findOrderPayedItems`/`findServiceCompletedItems`.
- [ ] Фильтрация по выбранным типам заказов в `OrderPayedEntity.calculate`/`matchesOrder` и `ServiceCompletedEntity.calculate`.
- [ ] Валидация/фабрика создания правил (`salary-rule.factory.ts`) корректно обрабатывает новое поле только для `OrderPayed`/`ServiceCompleted`.
**Тесты:** обновить/добавить unit-тесты `order-payed.entity.spec.ts`/`service-completed.entity.spec.ts` (с указанными типами, без указания — «все», пустой результат при несовпадении); unit на `ServiceCalculationDataRepository` (поле в выборке).
**Когда готово**: правило `OrderPayed`/`ServiceCompleted` с указанными типами заказов начисляет только по заказам этих типов; без указания — по всем; `PayPerHour`/`TaskCompleted` не принимают поле; изменение поля не меняет снапшоты уже закрытых периодов; все тесты зелёные.

### Фаза 4: Frontend — форма плана продаж: выбор типов заказов
**Цель**: Руководитель выбирает типы заказов при создании/редактировании плана продаж в UI.
**Что затрагивает?** frontend
**Задачи:**
- [ ] `queryOptions` для `GET /v1/service/reports/order-type` в модели плана продаж.
- [ ] Мультиселект типов заказов в форме создания/редактирования плана (`EditPlanModal`/`useEditPlanForm`).
- [ ] Выбранные id передаются в payload create/update плана.
- [ ] Выбранные типы заказов (названия) отображаются при просмотре плана.
**Тесты:** ручная проверка в браузере (выбор/снятие типов заказов, сохранение, отображение после перезагрузки страницы); `npm run build`, `npm run lint`.
**Когда готово**: в форме плана можно выбрать и снять типы заказов; выбор сохраняется и виден после перезагрузки; build/lint без ошибок; проверено в браузере.

### Фаза 5: Frontend — форма зарплатного правила: выбор типов заказов
**Цель**: Руководитель выбирает типы заказов при создании правил `OrderPayed`/`ServiceCompleted`.
**Что затрагивает?** frontend
**Задачи:**
- [ ] Переиспользование `queryOptions` для `order-type` (Фаза 4) в модуле `SalaryRuleForm`.
- [ ] Мультиселект типов заказов в карточке правила, показывается только для типов `OrderPayed`/`ServiceCompleted`.
- [ ] Выбранные id передаются в payload создания правила (`MotivationRequest`).
- [ ] Для `PayPerHour`/`TaskCompleted` контрол не отображается.
**Тесты:** ручная проверка в браузере (создание правила `OrderPayed`/`ServiceCompleted` с выбором типов заказов, сохранение; проверка отсутствия контрола у `PayPerHour`/`TaskCompleted`); `npm run build`, `npm run lint`.
**Когда готово**: форма создания правила `OrderPayed`/`ServiceCompleted` предлагает выбор типов заказов и сохраняет его; `PayPerHour`/`TaskCompleted` не показывают контрол; build/lint без ошибок; проверено в браузере.
