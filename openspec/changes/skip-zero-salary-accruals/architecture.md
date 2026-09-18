# Architecture: skip-zero-salary-accruals

## Scope

Изменение затрагивает только внутреннюю логику построения уже существующих сущностей/DTO в модуле
`accounting` доменов `service` и `shop`: фильтрацию нулевых строк правил при построении документа
начисления (закрытие периода) и при построении построчной разбивки зарплатного отчёта. Новых
entity, страниц или UI-компонентов не вводится; фронтенд получает уже отфильтрованные данные без
изменений своего кода.

Здесь и далее таблицы приведены один раз для обоих доменов — `service` и `shop` реализуют один и тот
же класс/сервис отдельными, независимыми файлами в `domains/service/modules/accounting/...` и
`domains/shop/modules/accounting/...` (см. `backend/CLAUDE.md`, изоляция service/shop); правки
вносятся в оба параллельно, без общего кода между доменами.

---

## Backend — Domain Model

### Entities

| Name | Status (new/existing) | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `SalaryAccrual` | existing | да | `employeeId, period, direction, status, lines: SalaryAccrualLine[], total` | Документ начисления на сотрудника за период; поведение не меняется, меняется только состав `lines`, который в него попадает при создании |
| `SalaryAccrualLine` | existing | нет (часть агрегата `SalaryAccrual`) | `ruleId, type, amount, originalAmount` | Строка начисления по одному зарплатному правилу; для правил с `amount === 0` перестаёт создаваться |

### Aggregates

| Aggregate | Root entity | Входит в состав (entities/VO) | Инварианты, которые защищает |
|---|---|---|---|
| `SalaryAccrual` | `SalaryAccrual` | `SalaryAccrualLine[]` | Целостность строк начисления (`Number.isInteger(amount)` и т.п.) — не меняется; новое поведение — часть логики построения агрегата (какие строки в него попадают), не новый инвариант |

### Value Objects

_(нет новых VO — используются существующие примитивные `amount: number` строк и существующая
структура `RuleBreakdownLine`/`CalculationLine`, которые уже не являются частью изменяемого поведения)_

### Services

| Service | Слой | Ответственность |
|---|---|---|
| `CloseAccountingPeriodHandler` (`buildAccrualDocuments`) | application | Строит `SalaryAccrual[]` документов при закрытии периода — точка, где применяется фильтр «не создавать строку с суммой 0» |
| `SalaryAccrual.createFromSnapshot` (фабричный метод сущности) | domain | Строит `SalaryAccrualLine[]` документа из построчной разбивки правил сотрудника — сам фильтр применяется здесь, перед конструированием строки |
| `buildRuleBreakdown` (`rule-breakdown.builder.ts`) | domain | Строит `RuleBreakdownLine[]` из результата расчёта правил (`CalculationLine[]`) — без изменений (уже пропускает только правила с `calculate() === null`) |
| `buildSalaryReportRules` (`to-salary-report-rules.ts`) | application | Сводит FACT- и PROGNOSE-прогоны `buildRuleBreakdown` по `ruleId` в `EmployeeSalaryReportRule[]` — здесь после сведения применяется фильтр «скрыть строку, если и факт, и прогноз равны нулю», с исключением для типа «за выполнение задачи» |
| `GetEmployeeSalaryReportService` / `GetDepartmentSalaryReportService` | application | Отдают зарплатный отчёт через `buildSalaryReportRules` — без изменений сигнатур, получают уже отфильтрованный список |

### Method Signatures (ключевые, по каждому сервису)

| Service.Method | Params | Returns | Краткое описание |
|---|---|---|---|
| `CloseAccountingPeriodHandler.buildAccrualDocuments` | `(period, rows: AccountingPeriodSnapshotRow[])` | `SalaryAccrual[]` | Сигнатура не меняется; внутренний вызов `createFromSnapshot` теперь получает уже отфильтрованный (или сам фильтрует) набор строк с `amount !== 0` |
| `SalaryAccrual.createFromSnapshot` | `(params: {..., lines: RuleBreakdownLine[] или эквивалент})` | `SalaryAccrual` | Сигнатура не меняется; строки с `amount === 0` не попадают в `SalaryAccrualLine[]` результата |
| `buildSalaryReportRules` | `(factLines: RuleBreakdownLine[], prognoseLines: RuleBreakdownLine[])` | `EmployeeSalaryReportRule[]` | Сигнатура не меняется; после сведения по `ruleId` из результата исключаются строки, где `amount.fact === 0 && amount.prognose === 0`, кроме строк типа «за выполнение задачи» |

---

## Frontend — UI Model

Frontend не меняется: `pages/SalaryReportV2` (`SalaryReportV2Page`, `/salaries`, `/salaries/employee/:id`)
как и раньше рендерит список `EmployeeSalaryReportRule[]`, пришедший от `GET
/v1/{service|shop}/accounting/salary_report/...` — просто список теперь короче. Новых
компонентов/хуков/страниц не требуется.

Единственная проверка, которую нужно сделать на этапе реализации (не архитектурное изменение, пункт
для `tasks.md`): убедиться, что существующие `RuleGroupDetailsPanel`/`LedgerRuleRow` корректно не
рендерят пустую панель, если после фильтрации у группы правил не осталось ни одной строки (см.
design.md → Risks).

### Pages

| Page | Route | Структура | Назначение |
|---|---|---|---|
| `SalaryReportV2` (existing, без изменений) | `/salaries`, `/salaries/employee/:id` | без изменений | Отображает зарплатный отчёт; получает уже отфильтрованные строки от бэкенда |

### Features / UI-компоненты / Hooks

_(без изменений — новых не вводится, существующие не меняют публичный API)_

### Паттерны, которые нужно учесть при проектировании

- [x] Не применимо — фронтенд не меняется, только состав данных, приходящих с бэка

---

## Diagrams

По решению пользователя диаграммы для этого изменения не создавались на Miro — изменение не вводит
новых entity, модулей или UI, и полностью укладывается в текстовое описание потока ниже.

**Поток данных (закрытие периода):**
`CloseAccountingPeriodHandler.execute` → `CalculateServiceSnapshotRowsService.calculate` (без
изменений, считает `CalculationLine[]` по каждому правилу) → `buildAccrualDocuments` →
`SalaryAccrual.createFromSnapshot` (**новый фильтр**: строка с `amount === 0` не становится
`SalaryAccrualLine`) → `UnitOfWork.run` (сохранение периода/снапшота/`accrualRepo.saveAll`, без
изменений).

**Поток данных (зарплатный отчёт):**
`GetEmployeeSalaryReportHttpController` → `GetEmployeeSalaryReportService` →
`buildRuleBreakdown` ×2 (FACT/PROGNOSE, без изменений) → `buildSalaryReportRules` (сведение по
`ruleId`, **новый фильтр**: строка исключается, если `amount.fact === 0 && amount.prognose === 0`, за
исключением типа «за выполнение задачи») → HTTP-ответ (`EmployeeSalaryReportResponse.rules`) →
`SalaryReportV2Page` (без изменений, рендерит то, что пришло).

Оба домена (`service`/`shop`) — одинаковый поток по своим независимым файлам.

---

## Confirmation Checklist

- [ ] Названия entity/aggregate согласованы (изменений структуры нет — только поведение построения)
- [ ] Названия и сигнатуры ключевых методов сервисов согласованы (сигнатуры не меняются, меняется
  внутренняя логика `SalaryAccrual.createFromSnapshot` и `buildSalaryReportRules`)
- [ ] Frontend не требует изменений — согласовано отсутствие новых страниц/компонентов
- [ ] Текстовое описание потока (вместо Miro-диаграмм) отражает ожидаемую реализацию
- [ ] Пользователь подтвердил переход к tasks.md
