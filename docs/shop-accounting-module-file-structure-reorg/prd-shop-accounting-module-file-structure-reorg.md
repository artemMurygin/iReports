# PRD: Shop Accounting Module File Structure Reorganization

**Дата**: 2026-08-28
**Статус**: Draft

## Цель

Плоские папки `backend/src/domains/shop/modules/accounting/application/{command,services,mappers,ports}`
и `interface/{http-controllers,dto}` разрослись до 20–45 файлов каждая, тесты (`.spec.ts`) лежат
вперемешку с исходным кодом — это затрудняет чтение и code review. Нужно перегруппировать файлы этих
папок в подпапки по доменным кластерам, чтобы структура каталогов отражала предметную область модуля
и review велось по границам одной бизнес-фичи, а не по алфавиту вперемешку с остальными.

## Пользовательские сценарии

- Разработчик открывает `application/command/` → видит подпапки по кластерам (`salary-accrual/`,
  `payout/` и т.д.), а не 45 файлов вперемешку.
- Ревьюер открывает PR, меняющий логику начисления зарплаты → изменённые файлы (command, handler,
  spec, controller, dto) сгруппированы в одном кластере `salary-accrual`, границы изменения видны
  сразу.
- Новый разработчик ищет «как устроены выплаты» → находит все связанные файлы (`create-shop-payout*`,
  `create-shop-payout-batch*`, `delete-shop-payout*` во всех слоях) в одной подпапке `payout/` на
  каждом слое, вместо grep по всему модулю.
- Разработчик добавляет `.spec.ts` к новому файлу → тест лежит рядом с исходником в той же подпапке
  кластера, конвенция Jest/Nest не нарушается.

## В скоупе

- Реорганизация `application/command/`, `application/services/`, `application/mappers/`,
  `application/ports/` в подпапки по кластерам.
- Реорганизация `interface/http-controllers/`, `interface/dto/` в те же подпапки по кластерам.
- Согласованный список кластеров (одинаковый набор имён подпапок во всех перечисленных выше
  директориях, где применимо):
  - **`salary-accrual`** — начисление/корректировка/отмена строк начисления (`accrue-*-line`,
    `accrue-*-document`, `accrue-period-*`, `adjust-*-line`, `unaccrue-*-line`,
    `accrue-shop-draft-lines.helper`, `get-shop-salary-accrual.service`,
    `list-shop-salary-accruals.service`, соответствующие ports/mappers/controllers/dto).
  - **`accounting-period`** — жизненный цикл расчётного периода (`close-*`, `reopen-*`,
    `recalculate-*-accounting-period`, `get-shop-accounting-period.service`,
    `get-shop-close-period-preview.service`, соответствующие ports/mappers/controllers/dto).
  - **`motivation-schema`** — схемы мотивации и правила зарплаты внутри них (`create/update-shop-
    motivation-schema`, `get/list-shop-motivation-schema*`, `create-shop-salary-rule`,
    `list-salary-rule-types.service`, соответствующие ports/mappers/controllers/dto).
  - **`payout`** — выплаты (`create-shop-payout`, `create-shop-payout-batch`, `delete-shop-payout`,
    соответствующие controllers/dto).
  - **`task-completion`** — выполнение задач (`create/confirm/delete-shop-task-completion`,
    `list-shop-task-completions.service`, соответствующие ports/mappers/controllers/dto).
  - **`erp-cash`** — конфигурация и документы ERP-кассы (`get-shop-erp-cash-config.service`,
    связанные ports/mappers/controllers).
  - **`salary-report`** — отчёты по зарплате (`get-shop-employee-salary-report.service`,
    `get-shop-department-salary-report.service`, связанные mappers/controllers).
  - **`calculation`** — сквозная расчётная инфраструктура, используемая несколькими кластерами
    (`build-shop-calculation-context.service`, `calculate-shop-snapshot-rows.service`,
    `resolve-shop-employee-salary-rules.service`, `shop-calculation-data.port`,
    `shop-snapshot-rows-calculator.port`, `shop-accounting-calculation-cache.port`).
- Co-location тестов: каждый `.spec.ts` переезжает вместе со своим исходным файлом в ту же подпапку
  кластера (тесты не выносятся в отдельное параллельное дерево).
- Правка всех относительных импортов, затронутых переносом, включая `shop-accounting.module.ts`.
- Перенос файлов через `git mv` (или эквивалент), сохраняющий историю по каждому файлу.

## Не в скоупе

- `domain/` и `infrastructure/` слои модуля — остаются плоскими в этой итерации (зафиксировано
  явным решением, не будущая доработка этого PRD).
- Любые изменения бизнес-логики, поведения хендлеров/сервисов/контроллеров.
- Изменение архитектуры слоёв верхнего уровня (`domain/application/infrastructure/interface`
  остаются как есть).
- Переименование классов/экспортов — только перенос файлов и правка путей импорта (переименование
  допустимо исключительно при конфликте имён внутри новой подпапки).
- Устранение находок из предыдущего DDD-ревью (`docs/shop-accounting-ddd-review.md`) — утечка
  бизнес-правила в `create-shop-payout.handler.ts`, отсутствие обработчиков domain events,
  дублирование эвристики `appliedPercent` и т.д. — отдельная задача.
- Изменение публичных HTTP-путей (`routesV1`) и контрактов (`ireports-contracts`).
- Реорганизация зеркального модуля `domains/service/modules/accounting`.

## Технические ограничения

- После переноса `npm run lint && npm run test && npm run build` должны проходить без регрессий.
- Публичные HTTP-пути не меняются — переезжает только внутренняя раскладка файлов.
- Не вводить новые barrel/index-файлы с реэкспортом ради группировки, если это не требуется для
  устранения конфликта путей — модуль сейчас не использует barrel-паттерн, менять это не в скоупе.
- Часть файлов правдоподобно принадлежит нескольким кластерам (например, мапперы, связанные с
  `sales-performance`, могут тяготеть и к `salary-accrual`, и к `salary-report`) — для каждого файла
  выбирается ровно один кластер по списку выше, дублирования файла в двух подпапках быть не должно.
- `shop-accounting.module.ts` должен продолжать корректно регистрировать все провайдеры/хендлеры
  после смены путей импорта.

## Критерии готовности

- [ ] `application/command/`, `application/services/`, `application/mappers/`, `application/ports/`
      разложены по подпапкам согласованных кластеров (`salary-accrual`, `accounting-period`,
      `motivation-schema`, `payout`, `task-completion`, `erp-cash`, `salary-report`, `calculation`).
- [ ] `interface/http-controllers/`, `interface/dto/` разложены по тем же подпапкам кластеров.
- [ ] Ни один файл не задублирован в двух подпапках; для каждого файла выбран ровно один кластер.
- [ ] Все `.spec.ts` остаются рядом с тестируемым файлом (в той же подпапке кластера).
- [ ] Все импорты в кодовой базе, ссылавшиеся на перемещённые файлы, обновлены (включая
      `shop-accounting.module.ts`).
- [ ] `npm run lint && npm run test && npm run build` проходят без ошибок и без изменений в
      количестве/составе упавших тестов относительно состояния до переноса.
- [ ] `ENDPOINTS.md` не требует изменений (публичные пути не менялись).
- [ ] Перенос файлов выполнен через `git mv`, история изменений по каждому файлу сохранена
      (`git log --follow` находит файл до переноса).
