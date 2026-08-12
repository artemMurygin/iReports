# Plan: Расчёт факта и прогноза продаж по категории (shop)

**PRD** реализуй расчет факта и прогноза продаж по категории
**Дата** 2026-08-12

## Контекст (уточнения к PRD)

PRD, переданный в задачу, состоял из одной строки без критериев готовности. Перед составлением плана
уточнены три развилки:

- **Домен**: только `shop` (МойСклад). В `service` (RoApp/RemOnline) понятия категории на уровне ERP
  нет — это зафиксировано прямо в коде (`service-sales-fact-source.port.ts`), расширение туда не
  входит в эту задачу.
- **Раскрытие категории**: если план составлен по родительской папке, в факт продаж засчитываются и
  продажи по вложенным дочерним папкам — тем же механизмом, что уже применяется в `ProductSoldEntity`
  (`ProductFolderTreeService.resolveDescendantFolderIds`).
- **Зарплатное правило `FloatPercent`**: сейчас оно сознательно берёт `salesPerformance` по отделу
  целиком (комментарий "issue #60" в `ProductSoldEntity`), т.к. факта по категории не существовало.
  Переключение `FloatPercent` на факт по категории правила включено в эту задачу отдельной фазой.

## Фазы реализации

### Фаза 1: Факт и прогноз продаж по категории в `modules/sales`

**Цель** `GET /v1/shop/sales/salesPerformance/:period` возвращает реальный (не нулевой) факт и
корректный прогноз для планов, составленных по категории (папке МойСклад), с учётом продаж по
вложенным дочерним категориям.

**Что затрагивает?** backend (`domains/shop/modules/sales`)

**Задачи:**
- [ ] Расширить `ShopSalesFactSourcePort.aggregate` дополнительным параметром — списком корневых
      `categoryId` (folderId), встречающихся среди планов запрошенного периода
      (`application/ports/shop-sales-fact-source.port.ts`).
- [ ] В `GetShopSalesPerformanceService.listForPeriod()` собрать уникальные непустые `plan.category` из
      уже полученных планов и передать их в `factSource.aggregate(period, categories)` — логика
      сопоставления факта с планом по `scopeKey(department, category)` уже корректна и изменений не
      требует.
- [ ] В `MoySkladSalesFactSourceRepository.aggregate()`: для каждой переданной корневой категории
      раскрыть потомков через `ProductFolderTreeService.resolveDescendantFolderIds` (переиспользовать
      сервис из `sync/moySklad` — тот же паттерн кросс-модульного переиспользования внутри домена
      `shop`, что уже применён в `ShopCalculationDataRepository`), построить обратный индекс
      `descendantFolderId → rootCategoryId`; определять категорию позиции как
      `position.product?.folderId ?? position.service?.folderId ?? null` (паттерн уже есть в
      `ShopCalculationDataRepository.findProductSoldItems`); агрегировать `turnover/margin/cost/quantity`
      по паре `(department, rootCategoryId)`; позиции, не попавшие ни в одну из запрошенных категорий,
      агрегировать по-прежнему в бакет `(department, null)` — для планов без категории поведение не
      меняется.
- [ ] Проверить/добавить `ProductFolderTreeService` в провайдеры `ShopSalesModule` (DI).
- [ ] Тесты: написать unit-тест для `MoySkladSalesFactSourceRepository.aggregate()` (сейчас тестов нет
      вообще) — кейсы «факт по category-плану учитывает продажи дочерней папки», «факт по
      department-плану без категории не меняется», «сумма корректно разносится между несколькими
      категориями одного отдела»; обновить `get-shop-sales-performance.service.spec.ts` под новую
      сигнатуру `aggregate`; обновить `shop-sales-performance.e2e.spec.ts` сценарием с планом по
      категории.

**Когда готово** Для плана с `category != null` в ответе `GET /v1/shop/sales/salesPerformance/:period`
`fact.turnover/margin/quantity/percentCompletion` и `prognose.*` рассчитаны по продажам этой категории
и её потомков (не равны нулю при наличии продаж); для плана без категории (`category === null`)
поведение не изменилось; все перечисленные тесты зелёные.

### Фаза 2: `FloatPercent` учитывает факт по категории правила

**Цель** Зарплатное правило `ProductSold` с типом вознаграждения `FloatPercent` начисляет процент по
выполнению плана **своей категории**, а не по отделу целиком — использует факт по категории, ставший
доступным в Фазе 1.

**Что затрагивает?** backend (`domains/shop/modules/accounting`)

**Задачи:**
- [ ] Расширить `CalculationContext.salesPerformance` с единственного значения (на отдел) до карты
      `category → percentCompletion` (ключ `null` — «весь отдел», для правил без категории) —
      обновить `toShopSalesPerformanceContext` (`application/mappers/`).
- [ ] В `BuildShopCalculationContextService`: резолвить `salesPerformance` не один раз на сотрудника, а
      для каждой уникальной категории среди правил `ProductSold`/`UsedProductSold` схемы сотрудника
      (переиспользуя уже собранный на этом же шаге список категорий, как в
      `resolveCategoryDescendantFolderIds`), вызывая `SHOP_SALES_PERFORMANCE_READER.findForScope` с
      реальной категорией правила вместо жёстко заданного `null`
      (`findSalesPerformance`, строка 146).
- [ ] В `ProductSoldEntity` (ветка `FloatPercent`, `calculate()`): читать `percentCompletion` из карты
      `context.salesPerformance` по `this.props.config.category` (fail closed — как и для
      `categoryDescendantFolderIds` — если для категории правила нет расчёта, вознаграждение не
      начисляется), убрать комментарий/обоснование "issue #60" как устаревшее.
- [ ] Обновить `docs/payroll/*` и `domains/shop/CLAUDE.md` в части, описывающей текущее ограничение
      «`FloatPercent` берёт `salesPerformance` по отделу целиком» — заменить на актуальное поведение.
- [ ] Тесты: обновить `product-sold.entity.spec.ts` (мок `context.salesPerformance` как карты),
      `build-shop-calculation-context.service.spec.ts` (проверка резолва по категориям правил),
      `get-shop-employee-salary-report.e2e.spec.ts` (сценарий с `FloatPercent` по конкретной
      категории, отличным от результата «по всему отделу»).

**Когда готово** Сотрудник с правилом `ProductSold`/`FloatPercent`, привязанным к конкретной категории,
получает вознаграждение, рассчитанное по проценту выполнения плана именно этой категории (проверяется
e2e-сценарием, где процент по категории и процент по отделу заведомо различаются); все перечисленные
тесты зелёные.
