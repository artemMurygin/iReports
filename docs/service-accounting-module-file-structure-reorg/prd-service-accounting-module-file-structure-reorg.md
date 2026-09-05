# PRD: Service Accounting Module File Structure Reorganization

**Дата**: 2026-09-04
**Статус**: Draft

## Цель

`domains/shop/modules/accounting` уже прошёл ручную реорганизацию (см.
[`docs/shop-accounting-module-file-structure-reorg`](../shop-accounting-module-file-structure-reorg)) и сейчас
служит эталоном: файлы сгруппированы по доменным кластерам во всех слоях, включая `domain/entities` и
`infrastructure/{mappers,repositories}`, а имена файлов не дублируют название домена (`role-source.ts`, а не
`shop-role-source.ts`). `domains/service/modules/accounting` — зеркальный модуль, реализующий те же бизнес-сценарии
для линии Service/RemOnline, — остался в старой плоской раскладке: `application/{command,services,ports}` и
`interface/{http-controllers,dto}` — плоские папки на 30–40 файлов, `domain/entities` сгруппирован лишь частично,
часть имён файлов и папок содержит опечатки или лишний домен-префикс. Нужно привести `domains/service` к тому же
структурному стандарту, что и `domains/shop`, без изменения бизнес-логики.

## Сравнение модулей (shop = эталон, service = текущее состояние)

| Слой / папка | shop (эталон) | service (текущее) | Действие |
|---|---|---|---|
| `application/command` | сгруппирован по кластерам (`accounting-period/`, `cashbox-payout/`, `motivation-schema/`, `salary-accrual/`) | плоский, 40+ файлов | сгруппировать по кластерам |
| `application/ports` | сгруппирован (`accounting-period/`, `calculation/`, `cashbox/`, `motivation-schema/`, `salary-accrual/`) | плоский, 11 файлов | сгруппировать по кластерам |
| `application/services` | сгруппирован (те же кластеры + `salary-report/`) | плоский, 14 файлов | сгруппировать по кластерам |
| `application/mappers` | только `salary-report/` | только `salary-report/` | уже совпадает — без изменений |
| `application/events` | слоя нет вообще (события не обрабатываются) | плоский, 2 event-handler'а (`accounting-period-closed`, `motivation-schema-created`) — реально используются в `accounting.module.ts` | у shop аналога нет; разложить по той же логике кластеров, что и `application/command` (см. «Не в скоупе» — в shop эти хендлеры не добавляем) |
| `interface/dto` | сгруппирован (`accounting-period/`, `cashbox-payout/`, `motivation-schema/`, `salary-accrual/`) | плоский, 9 файлов | сгруппировать по кластерам |
| `interface/http-controllers` | сгруппирован (те же кластеры + `cashbox/`, `salary-report/`) | плоский, 30+ файлов | сгруппировать по кластерам |
| `domain/entities` | сгруппирован полностью (`accounting-period/`, `cashbox/`, `motivation-schema/`, `salary-accrual/`, `salary-rules/`) | сгруппирован только `salary-rules/`, остальное плоское (6 файлов) | догруппировать оставшиеся |
| `domain/value-objects` | плоский (`float-percent-schedule`, `money`, `motivation-target`, `period-closure`) — все 4 как VO-класс | плоский, но только 2 файла (`motivation-target`, `period-closure`); деньги/процент выполнения плана реализованы как **свободные функции** в `domain/services/money.ts` и `domain/services/float-percent.ts` | архитектурное расхождение, не только файловое — см. «Открытые вопросы» |
| `domain/services` | плоский, имена без домен-префикса (`role-source.ts`, `erp-demand-link-builder.ts`) | плоский, но `service-role-source.ts` дублирует домен в имени файла, `roapp-order-link.ts` называется по вендору (RoApp), а не по роли (erp-order-link) | переименовать 2 файла |
| `domain/exceptions` | плоский, без опечаток | плоский, но есть отдельная папка `domain/exeptions/salary-rule.exeption.ts` (опечатка в имени папки, файла и класса; класс нигде не используется) | исправить/удалить |
| `domain/types` | плоский, без опечаток | плоский; лишний закоммиченный `salary-rule.types.js` (артефакт компиляции); `service-calculation-data.types.ts` дублирует домен в имени файла | удалить `.js`, переименовать `.ts` |
| `domain/events`, `domain/factories`, `domain/salary-rule-registry.ts` | плоские | плоские, имена уже совпадают с конвенцией | без изменений |
| `infrastructure/mappers` | сгруппирован (`accounting-period/`, `cashbox/`, `motivation-schema/`, `salary-accrual/`) | уже сгруппирован (`accounting-period/`, `erp-cash/`, `motivation-schema/`, `salary-accrual/`) | без изменений (кроме словаря `cashbox` vs `erp-cash`, см. ниже) |
| `infrastructure/repositories` | сгруппирован (те же кластеры + `calculation/`) | уже сгруппирован так же | без изменений, кроме переноса конфигурации кассы (см. ниже) |
| конфигурация кассы | `shopErpCashConfig` лежит прямо в `infrastructure/repositories/cashbox/cashbox.config.ts`, читается `ShopCashboxConfigRepository` там же | `serviceErpCashConfig` лежит в отдельной **корневой** папке `config/erp-cash.config.ts`, читается `ErpCashConfigProvider` из отдельной папки `infrastructure/config/` | перенести обе части в `infrastructure/repositories/erp-cash/`, переименовать провайдер в репозиторий |
| `set-task-rule-actual-amount.command.ts` | аналога нет | лежит в `application/command/`, не имеет `.handler.ts`/использований — незавершённый стаб (см. комментарий в файле, ссылка на будущий сценарий "Ручной ввод фактической суммы") | оставить как есть по содержанию, только переместить в кластер `salary-accrual/`; отметить как открытый вопрос авторства |
| `paid-order-status.ts`, `roapp-order-link.ts` (после переименования) | аналогов нет — бизнес-логика специфична для RemOnline (RoApp order status / order link) | используются в `salary-rules/order-payed.entity.ts`, `service-completed.entity.ts` | не переносить в shop и не удалять — легитимное отличие домена, только переименование по правилу выше |

### Словарь имён: `cashbox` (shop) vs `erp-cash` (service)

В shop касса МойСклад везде называется `cashbox`/`cashbox-payout`. В service касса RemOnline уже везде называется
`erp-cash` (`application/ports/erp-cash-*.port.ts`, `infrastructure/{mappers,repositories}/erp-cash/`) — это
установившийся словарь модуля service, а не расхождение с shop, которое нужно устранять. План использует `erp-cash`
и `erp-cash-payout` как имена кластеров в service (а не дословно скопированный `cashbox`/`cashbox-payout`), чтобы не
плодить два слова для одной сущности внутри одного модуля.

## Пользовательские сценарии

- Разработчик открывает `application/command/` в `domains/service` → видит подпапки по кластерам, как и в
  `domains/shop`, а не 40 файлов вперемешку.
- Разработчик, работавший над shop, переключается на service → узнаёт те же имена кластеров и тот же принцип
  (файл без домен-префикса, класс/тип — с префиксом при необходимости).
- Ревьюер PR по начислению зарплаты service находит все связанные файлы (`command`, `handler`, `spec`, `controller`,
  `dto`, `entity`) в одной подпапке `salary-accrual/` на каждом слое.
- Разработчик ищет конфигурацию кассы RemOnline → находит её там же, где ожидает по аналогии с shop:
  `infrastructure/repositories/erp-cash/`, а не в отдельной корневой `config/`.

## В скоупе

- Реорганизация `application/{command,services,ports}` в подпапки по кластерам: `accounting-period`,
  `erp-cash-payout`, `motivation-schema`, `salary-accrual`, `erp-cash`, `salary-report`, `calculation`.
- Реорганизация `interface/{http-controllers,dto}` в те же подпапки кластеров.
- Реорганизация `application/events` (слой, которого нет в shop) в подпапки `accounting-period/`,
  `motivation-schema/` — по аналогии с тем, как сгруппированы `application/command` этих же кластеров.
- Догруппировка `domain/entities` в подпапки `accounting-period/`, `erp-cash/`, `motivation-schema/`,
  `salary-accrual/` (`salary-rules/` уже готов).
- Нормализация имён файлов без переноса в подпапки:
  - `domain/services/service-role-source.ts` (+`.spec.ts`) → `role-source.ts`;
  - `domain/services/roapp-order-link.ts` → `erp-order-link-builder.ts`, функция `buildRoappOrderLink` →
    `buildErpOrderLink` (2 места использования);
  - `domain/types/service-calculation-data.types.ts` → `calculation-data.types.ts`.
- Устранение опечатки `domain/exeptions/salary-rule.exeption.ts` (папка/файл/класс) — перенос в
  `domain/exceptions/`, исправление имени (см. «Открытые вопросы» — используется ли класс).
- Удаление закоммиченного артефакта компиляции `domain/types/salary-rule.types.js`.
- Перенос конфигурации кассы RemOnline: `config/erp-cash.config.ts` +
  `infrastructure/config/erp-cash-config.provider.ts` → `infrastructure/repositories/erp-cash/`, переименование
  `ErpCashConfigProvider` → `ErpCashConfigRepository` (роль класса — репозиторий поверх `.env`, как и у shop
  `CashboxConfigRepository`, а не «provider»).
- Co-location тестов: каждый `.spec.ts` переезжает вместе со своим исходным файлом.
- Правка всех импортов, затронутых переносом, включая `accounting.module.ts`.
- Перенос файлов через `git mv` (или эквивалент), сохраняющий историю.

## Не в скоупе

- Изменения бизнес-логики, поведения хендлеров/сервисов/контроллеров/расчётов.
- Реализация обработки domain events в `domains/shop` «по аналогии с service» — это добавление новой
  функциональности, а не структурный рефакторинг; не входит в этот PRD.
- Превращение `domain/services/money.ts` и `domain/services/float-percent.ts` в value-object классы (как у shop) —
  это архитектурное изменение поведения/API, а не переименование файла; см. «Открытые вопросы».
- Массовое добавление домен-префикса (`Service...`) к экспортам, у которых его сейчас нет, «для полного
  соответствия» конвенции shop (`Shop...` на классах/функциях) — за пределами прямого запроса «нормализовать имена
  файлов»; конкретные точечные переименования (роль-сорс, ссылка на заказ, конфиг-репозиторий) — в скоупе, массовая
  ревизия остальных ~100 экспортов — нет.
- Удаление/доработка `set-task-rule-actual-amount.command.ts` как незавершённой фичи — только перенос в правильный
  кластер.
- Изменение публичных HTTP-путей (`routesV1`) и контрактов (`ireports-contracts`).
- Изменение `domains/shop/modules/accounting` (эталон, уже приведён в порядок).

## Технические ограничения

- После каждой фазы `npm run lint && npm run test && npm run build` в `backend/` — без регрессий (тот же состав
  падающих/проходящих тестов, что и до неё).
- Публичные HTTP-пути не меняются.
- Barrel/index-файлы не вводятся.
- Каждый файл — ровно в одном кластере, дублирования быть не должно.
- `accounting.module.ts` должен продолжать корректно регистрировать все провайдеры/хендлеры после смены путей.
- Переименование класса `ErpCashConfigProvider` → `ErpCashConfigRepository` — единственный намеренный rename
  экспорта в этом плане (кроме переименования функции `buildRoappOrderLink`); все точки внедрения (DI-токен в
  `accounting.module.ts`) обновляются вместе с переносом.

## Открытые вопросы

1. **`domain/exeptions/salary-rule.exeption.ts`** — класс `SalaryRuleExeption` нигде не используется (проверено
   grep'ом по `domains/service`). Предлагается удалить как мёртвый код при переносе, а не просто исправить опечатку
   в неиспользуемом файле. Нужно подтверждение перед удалением.
2. **`money.ts` / `float-percent.ts` как value objects** — у shop это `Money`/`FloatPercentSchedule` в
   `domain/value-objects/`, у service — свободные функции в `domain/services/`. Комментарий в коде service объясняет
   выбор (Int-рубли без копеек), но не объясняет, почему не VO. Предложение по умолчанию: **не переносить и не
   переделывать** в рамках этого PRD (это поведенческое изменение API, а не файловая нормализация) — оставить как
   отдельную задачу, если понадобится. План ниже придерживается этого решения по умолчанию.
3. **`set-task-rule-actual-amount.command.ts`** — стаб без `.handler.ts`, судя по комментарию — задел под сценарий
   "Ручной ввод фактической суммы по закрытой задаче". Оставляем файл как есть, просто переносим в кластер
   `salary-accrual/`.

## Критерии готовности

- [ ] `application/{command,services,ports}` разложены по кластерам: `accounting-period`, `erp-cash-payout`,
      `motivation-schema`, `salary-accrual`, `erp-cash`, `salary-report`, `calculation`.
- [ ] `interface/{http-controllers,dto}` разложены по тем же кластерам.
- [ ] `application/events` разложен по кластерам `accounting-period/`, `motivation-schema/`.
- [ ] `domain/entities` полностью сгруппирован (`accounting-period/`, `erp-cash/`, `motivation-schema/`,
      `salary-accrual/`, `salary-rules/`).
- [ ] `domain/services/role-source.ts`, `domain/services/erp-order-link-builder.ts`,
      `domain/types/calculation-data.types.ts` переименованы, импорты обновлены.
- [ ] `domain/exeptions/` (опечатка) устранена: файл удалён или перенесён в `domain/exceptions/` с исправленным
      именем — по итогам «Открытого вопроса 1».
- [ ] `domain/types/salary-rule.types.js` удалён из репозитория.
- [ ] Конфигурация кассы RemOnline перенесена в `infrastructure/repositories/erp-cash/`; `ErpCashConfigProvider`
      переименован в `ErpCashConfigRepository`; отдельные папки `config/` и `infrastructure/config/` в модуле
      accounting service больше не существуют.
- [ ] Ни один файл не задублирован в двух кластерах.
- [ ] Все `.spec.ts` остаются рядом со своим файлом.
- [ ] Все импорты обновлены, включая `accounting.module.ts`.
- [ ] `npm run lint && npm run test && npm run build` проходят без регрессий.
- [ ] `ENDPOINTS.md` не требует изменений.
- [ ] Перенос выполнен через `git mv`, история сохранена (`git log --follow`).
