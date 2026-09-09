## Context

См. `proposal.md` — «Why» и «What Changes» для мотивации и списка целей/не-целей.

Два архитектурных факта определяют подход:

1. `backend/CLAUDE.md`/`domains/{service,shop}/CLAUDE.md` декларируют, что `service` и `shop` **не
   импортируют код друг у друга напрямую** (issue #57) — у каждого свои независимые
   Entity/Registry/Factory/Port/Repository-классы зарплатных правил. Это по-прежнему в силе: весь общий
   код в этом изменении лежит только в третьей, нейтральной точке под `src/shared/`, ни один домен не
   импортирует файлы другого домена напрямую.
2. `src/shared/domain/` — **не** подходящее место для новых файлов. Там уже накопился технический долг:
   папка задумана под технические DDD-базовые классы (`entity.base.ts`, `value-object.base.ts` и т.п.),
   но фактически туда же попали бизнес-специфичные примитивы зарплатного/продажного домена
   (`period.value-object.ts`, `percent.ts`, `calculation-context.ts`/`calculation-line.ts`,
   `employee-salary-rules.ts`) — они кодируют знания о предметной области (формат расчётного периода,
   формула процента выполнения плана, форма результата зарплатного правила), а не техническую
   инфраструктуру. Это задокументировано как известный антипаттерн прямо в `backend/CLAUDE.md` (раздел
   «Shared DDD building blocks»). Существующие файлы этим изменением не переносятся (отдельная, более
   крупная задача — не входит в non-goals ниже отдельным пунктом, но по духу та же логика: разгребать
   весь `shared/domain/` — не цель узкого рефакторинга по устранению копипаста), но новые файлы,
   которые появляются в рамках ЭТОГО изменения, не должны туда добавляться и продолжать то же смешение.

Четыре куска, которые извлекаются, отличаются по тому, обёрнута ли математика в Value Object с
инвариантами:
- `money.ts` (service, свободная функция) vs `money.value-object.ts` (shop, VO без реальной валидации —
  просто обёртка над тем же `Math.round`).
- `float-percent.ts` (service, свободные функции, без валидации входа) vs
  `float-percent-schedule.value-object.ts` (shop, VO `FloatPercentSchedule.create()` **с реальной
  валидацией**: непустые названия порогов, неотрицательные значения, строго возрастающий порядок).
- `period-calculation.orchestrator.ts` — в обоих доменах одинаковый класс с методами-статиками,
  отличается только типами дженерик-параметров в сигнатуре.
- `scopeKey()` внутри `get-sales-performance.service.ts` — идентичная чистая функция в обоих доменах,
  остальной класс (`findForScope`, ERP-специфичное чтение) не трогается.

Различие в валидации между service/shop-версией `float-percent` — реальный поведенческий факт, не
стилистический, и определяет решение №2 ниже.

## Goals / Non-Goals

**Goals:**
- Устранить копипаст самой расчётной математики (тело алгоритмов), не меняя наблюдаемое поведение ни в
  `service`, ни в `shop` — включая то, что сейчас `service` не валидирует пороги `FloatPercent`, а `shop`
  валидирует.
- Оставить `service` и `shop` по-прежнему НЕ импортирующими код друг у друга — весь общий код лежит
  только в новой папке `src/shared/salary-calculation/`.
- Не добавлять новых файлов в `src/shared/domain/` — не компаундить задокументированный там антипаттерн
  смешения технической базы с бизнес-знаниями; новые бизнес-примитивы получают собственную, явно
  бизнес-именованную папку под `src/shared/`.
- Минимизировать площадь изменений на стороне вызывающего кода: там, где домен уже держит собственный
  публичный класс/API (`Money`, `FloatPercentSchedule` в shop), этот класс/API сохраняется — меняется
  только его внутренняя реализация.

**Non-Goals:**
- Пересмотр независимости `SalaryRuleRegistry`, Entity-классов правил, портов/репозиториев — они остаются
  раздельными (см. также proposal.md).
- Объединение application-сервисов зарплатных отчётов (`get-employee-salary-report.service.ts` и т.п.).
- Изменение видимого API/типов `Money`/`FloatPercentSchedule` в shop — потребители (Entity-классы правил)
  не переписываются.
- **Не входит:** ревизия существующего содержимого `src/shared/domain/` (`period.value-object.ts`,
  `percent.ts`, `calculation-context.ts`/`calculation-line.ts`, `employee-salary-rules.ts`) — они
  остаются на месте как задокументированный технический долг; это изменение только не увеличивает его.

## Decisions

### 1. Новая папка `src/shared/salary-calculation/`, а не `src/shared/domain/`

Новые файлы — `src/shared/salary-calculation/money.ts`, `float-percent.ts`,
`period-calculation.orchestrator.ts`, `sales-scope.ts` — получают собственную, явно бизнес-именованную
папку внутри `src/shared/` (на одном уровне с `src/shared/domain/`, `src/shared/application/`,
`src/shared/infrastructure/`), а не смешиваются с техническими базовыми классами.
**Альтернатива (отклонена)**: положить рядом с `Period`/`percentOf` в `src/shared/domain/`, по аналогии
с уже существующим прецедентом. Отклонено, потому что этот прецедент сам признан антипаттерном (см.
Context) — повторение той же ошибки увеличило бы объём будущей уборки вместо того, чтобы её не
создавать. **Альтернатива (отклонена)**: сразу перенести и старые файлы (`Period`, `percentOf` и т.д.) в
новую папку заодно. Отклонено — это самостоятельный рефакторинг с более широким blast radius
(потребители по всему `sales`/`accounting` в обоих доменах), заслуживающий отдельного change; смешивать
его с узкой задачей устранения копипаста рискованно и раздувает эту задачу далеко за её проспект.

### 2. `float-percent`: в shared переезжает только чистый алгоритм, не валидация

`src/shared/salary-calculation/float-percent.ts` получает три функции один-в-один из текущего
`domains/service/.../float-percent.ts` (`resolveFloatPercentMultiplier`, `resolveFloatPercentThresholds`,
`buildFloatPercentThresholdInfo`) — **без** валидации входных порогов, точно как сегодня в `service`.
`service` переключает импорт на `shared/salary-calculation` и удаляет свой файл — поведение не меняется
(валидации не было, не появляется). `shop`-VO `FloatPercentSchedule` **остаётся файлом в
`domains/shop/modules/accounting/domain/value-objects/`**, сохраняет `.create()` со всей текущей
валидацией (инварианты — правильное место для VO по `backend/CLAUDE.md`, раздел «Value objects»), но тело
`resolveMultiplier()`/`resolveThresholds()`/`buildThresholdInfo()` теперь вызывает функции из
`shared/salary-calculation/float-percent.ts` вместо реализации алгоритма второй раз.

**Альтернатива (отклонена)**: перенести саму `FloatPercentSchedule` VO целиком в `shared/salary-calculation/`,
чтобы `service` тоже мог её использовать. Отклонено, потому что это меняет наблюдаемое поведение одной из
сторон — либо `service` внезапно начинает валидировать (и падать) на данных, которые раньше проходили,
либо `shop` теряет валидацию, если общий тип строится по образцу `service` (без неё). Принцип «побайтово
идентичный результат до/после» из proposal.md требует держать VO/её инварианты только там, где они были.

### 3. `money`: `roundRubles()` переезжает как функция; `Money` VO в shop остаётся, но делегирует

`src/shared/salary-calculation/money.ts` экспортирует `roundRubles(amount: number): number` — сигнатура
идентична сегодняшней `service`-версии. `service` переключает импорт, удаляет свой `money.ts`.
`shop`-класс `Money` (4 потребителя: `pay-per-hour.entity.ts`, `product-sold.entity.ts`,
`used-product-sold.entity.ts`, `float-percent-schedule.value-object.ts`) **не удаляется** — его
статический метод `roundRubles()` продолжает возвращать `Money`, но внутри вызывает импортированную
`roundRubles()` вместо собственного `Math.round()`. Само значение (`Math.round`) у `Money` VO не несёт
инвариантов сверх того, что даёт голая функция — по критериям `backend/CLAUDE.md` («Value objects») это,
строго говоря, не обязано быть VO — но удаление класса потребовало бы переписать 4 файла-потребителя и
поменять их публичный API без необходимости для целей этого изменения (устранение дублирования, не
редизайн типов shop). **Альтернатива (отклонена)**: удалить `Money` VO и переключить 4 потребителя на
голый `number` — увеличивает площадь и риск изменения без выигрыша для заявленной цели; можно рассмотреть
отдельным change, если появится причина сильнее, чем «это не обязательно VO».

### 4. `PeriodCalculationOrchestrator`: один generic-класс по структурному интерфейсу правила

`src/shared/salary-calculation/period-calculation.orchestrator.ts`:
```ts
interface CalculableRule<TContext> {
    calculate(context: TContext): Promise<CalculationLine>;
}

export class PeriodCalculationOrchestrator<TContext, TRule extends CalculableRule<TContext>> {
    static async calculate<TContext, TRule extends CalculableRule<TContext>>(
        rules: TRule[],
        context: TContext,
    ): Promise<CalculationLine[]> { /* тело один-в-один с текущим */ }

    static total(lines: CalculationLine[]): number { /* без изменений */ }
}
```
Дженерик по структурному интерфейсу (`calculate(context): Promise<CalculationLine>`), а не по конкретным
`SalaryRule`/`ShopSalaryRule` union-типам — та же модель, что уже применена в `mergeEmployeeSalaryRules<TRule>`
(`RulesHolder<TRule>` в `shared/domain/employee-salary-rules.ts`) для точно той же проблемы «два домена,
несовместимые типы правил, общая по форме операция» — переиспользуется сам структурный подход к
типизации, а не физическое расположение файла. `CalculationLine` (сегодня в `shared/domain/calculation-line.ts`)
остаётся импортируемым оттуда как есть — этот файл не копируется и не переносится, только читается новым
кодом; его собственная переклассификация (домен vs инфраструктура) — вне рамок этого изменения (см.
Non-Goals). `service` и `shop` продолжают вызывать класс под тем же именем `PeriodCalculationOrchestrator`,
меняется только путь импорта. Оба локальных файла-оркестратора удаляются.

### 5. `scopeKey`: выносится только сама функция, `findForScope` остаётся в каждом домене

`src/shared/salary-calculation/sales-scope.ts` получает
`scopeKey(department: number, category: string | null): string` один-в-один. `findForScope()` в обоих
`get-sales-performance.service.ts` остаётся на месте (он ERP-зависим: дальше идёт чтение через
`SalesPerformanceReaderPort` своего направления) — меняется только импорт `scopeKey` вместо локального
определения функции в файле.

### 6. Обновление `CLAUDE.md`

- `backend/CLAUDE.md` — пометка об антипаттерне `src/shared/domain/` уже добавлена (раздел «Shared DDD
  building blocks») в рамках подготовки этого design.md. Дополнительно, как часть задач этого change:
  задокументировать `src/shared/salary-calculation/` рядом (новый абзац о том, где живут
  direction-агностичные бизнес-примитивы, переиспользуемые `service`/`shop` — в отличие от
  `src/shared/domain/`, которая только для технической базы).
- `domains/service/CLAUDE.md` (~строки 268-277) — формулировка «modules/accounting целиком... независимые
  реализации без переиспользования доменного кода между доменами» становится неточной: приложить
  оговорку — за вычетом чистой ERP-агностичной математики, вынесенной в `shared/salary-calculation`
  (перечислить те же 4 позиции), которая не даёт `shop` доступа к типам/классам `service` и наоборот.
- `domains/shop/CLAUDE.md` (~строки 113-114, 139) — убрать ставшие ложными утверждения «`money.ts`,
  `float-percent-schedule.ts` — зеркала, но отдельные файлы» и «собственный `PeriodCalculationOrchestrator`»
  — заменить на описание текущего состояния (используют общую реализацию из `shared/salary-calculation`,
  `Money`/`FloatPercentSchedule` остаются собственными VO-обёртками shop).

## Risks / Trade-offs

- **[Риск]** Кто-то в будущем прочитает прецедент «money/float-percent/orchestrator ушли в shared» как
  разрешение тащить туда что угодно общее между `service`/`shop`, включая ERP-специфичные Port/Repository
  — это ровно тот вид связности, что уже один раз стал проблемой (`docs/service-shop-boundary-violations.md`
  §2.1, 8 репозиториев `service`, напрямую подключённых в `shop`).
  → **Митигация**: граница явно зафиксирована в обновлённом `CLAUDE.md` (решение №6) — в
  `shared/salary-calculation` идут только stateless чистые функции/generic-классы без DI-токенов, без
  Prisma, без знания о конкретной ERP; ничего с side-effects или знанием о репозитории.
- **[Риск]** Расхождение между `service`- и `shop`-версией `float-percent` было (валидация только в shop);
  если это расхождение на самом деле баг, а не осознанное решение, наивное объединение could either
  silently fix или silently break одну из сторон.
  → **Митигация**: решение №2 явно сохраняет статус-кво по валидации на обеих сторонах вместо того, чтобы
  унифицировать её заодно — унификация валидации, если она нужна, это отдельное решение с отдельным
  проспектом (это меняет наблюдаемое поведение `service`, а не просто убирает дублирование).
- **[Риск]** Появление второй "общей" папки (`shared/salary-calculation/` рядом с уже существующей
  `shared/domain/`) может на первый взгляд выглядеть как ещё большее распыление, а не наведение порядка.
  → **Митигация**: это ровно расхождение, которое явно объясняется новым абзацем в `backend/CLAUDE.md`
  (решение №6) — `shared/domain/` для технической базы (с пометкой об известном долге),
  `shared/salary-calculation/` для бизнес-примитивов зарплатного расчёта, переиспользуемых `service`/
  `shop`. Названия папок сами документируют разницу.
- **[Риск]** Тесты `money`/`float-percent`/`orchestrator`, сегодня продублированные в обоих доменах,
  после объединения имплементации будут дублировать друг друга иначе — часть станет избыточной (одни и те
  же кейсы прогоняются дважды через разные обёртки).
  → **Митигация**: не критично для корректности (лишние тесты не ломают ничего), можно оставить, консолидация
  тестов — не обязательная задача при первом проходе; при желании можно почистить в будущем.

## Migration Plan

1. Добавить новые файлы в `src/shared/salary-calculation/` (`money.ts`, `float-percent.ts`,
   `period-calculation.orchestrator.ts`, `sales-scope.ts`) с unit-тестами (перенос существующих кейсов из
   обеих доменных `*.spec.ts`, без production-кода, ещё не подключено к потребителям).
2. Переключить `service`: заменить импорты `money.ts`/`float-percent.ts`/`period-calculation.orchestrator.ts`
   на `shared/salary-calculation/*`, удалить старые файлы; обновить импорт `scopeKey` в
   `domains/service/modules/sales/.../get-sales-performance.service.ts`.
3. Переключить `shop`: тело `Money.roundRubles()` и методов `FloatPercentSchedule` — на вызовы
   `shared/salary-calculation/*` вместо собственной реализации; заменить `PeriodCalculationOrchestrator` на
   импорт из `shared/salary-calculation`, удалить локальный файл оркестратора; обновить импорт `scopeKey`
   в `domains/shop/modules/sales/.../get-sales-performance.service.ts`.
4. Прогнать весь существующий набор unit/e2e/snapshot-тестов обоих доменов (`accounting`, `sales`) — ожидаемый
   результат: без изменений в снапшотах/ожидаемых суммах (чистый рефакторинг).
5. Обновить `backend/CLAUDE.md`, `domains/service/CLAUDE.md`, `domains/shop/CLAUDE.md` согласно решению №6.

**Откат**: чистый рефакторинг без изменений схемы БД/контрактов/API — откат стандартным `git revert`
коммитов этого change, без отдельного плана миграции данных.
