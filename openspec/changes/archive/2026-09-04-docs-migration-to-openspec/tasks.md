## 1. Скелет спеков и конвенция

- [x] 1.1 Убедиться, что `openspec/specs/conventions/documentation/spec.md` и
      `openspec/specs/service/accounting/spec.md` присутствуют в дереве специй этого change (созданы
      на этапе планирования) и проходят `openspec validate --strict` без ошибок формата.
- [x] 1.2 Дополнить `backend/CLAUDE.md` коротким разделом-указателем на `conventions/documentation`
      (по аналогии с уже существующими перекрёстными ссылками между CLAUDE.md-файлами) — так, чтобы
      разработчик, открывший backend/CLAUDE.md, узнавал о конвенции `spec:`-ссылок и находил её.

## 2. Скрипт-валидатор `spec:`-ссылок

- [x] 2.1 Решить и зафиксировать в коде расположение скрипта — `openspec/scripts/
      validate-spec-refs.mjs` (изначально был в `scripts/` в корне монорепозитория, перемещён в
      `openspec/scripts/` — единственная директория верхнего уровня под один файл не устроила,
      `openspec/scripts/` колоцирует его с тем, что он проверяет) — и его аргументы (каталоги для
      сканирования: `backend/src`, `frontend/src`).
- [x] 2.2 Реализовать сканирование исходников на предмет комментариев вида
      `spec: <capability-path>#<anchor>` и разбор пути/якоря из найденной строки; проверить на
      тестовых файлах с валидной и невалидной ссылкой, что обе распознаются корректно.
- [x] 2.3 Реализовать резолв `<capability-path>`: сначала в `openspec/specs/<capability-path>/spec.md`
      (главное дерево), если файла там нет — в `openspec/changes/*/specs/<capability-path>/spec.md`
      любого активного change; резолв `<anchor>` в заголовок найденного файла (GitHub-style slug:
      нижний регистр, пробелы → дефис, пунктуация вырезана) — проверить на заголовках из специй этого
      change (найдутся только через ветку delta, так как в главном дереве их ещё нет).
- [x] 2.4 Сделать так, чтобы скрипт завершался с ненулевым кодом и печатал файл/строку/отсутствующую
      цель при обнаружении ссылки, которая не резолвится — проверить вручную на специально
      сломанной ссылке (несуществующий `capability-path` и отдельно несуществующий `anchor`).
- [x] 2.5 Добавить npm-скрипт в корневом `package.json` для запуска валидатора локально/вручную
      (например, `npm run validate:specs`); подключение к CI не входит в этот change — в проекте
      сейчас нет CI-пайплайна с lint/test, к которому можно было бы его пристыковать (см. design.md).
      Проверить прогоном на текущем состоянии кода — до задачи 4 (ссылок ещё нет в коде) прогон
      должен быть тривиально зелёным.

## 3. Перенос `modules/accounting` в спек

- [x] 3.1 Заменить блок `### \`modules/accounting\`` в
      `backend/src/domains/service/CLAUDE.md` на краткое описание модуля и указатель на
      `openspec/specs/service/accounting/spec.md` для бизнес-правил (архитектурные детали —
      имена классов, файлов, DI — остаются в CLAUDE.md, как описано в
      `openspec/specs/conventions/documentation/spec.md`).
- [x] 3.2 Сверить получившийся спек `service/accounting` с самим кодом модуля
      (`backend/src/domains/service/modules/accounting/**`), в первую очередь с уже существующими
      unit/e2e-тестами модуля — каждое требование спека должно быть подтверждено хотя бы одним
      тестом или явно помечено как непокрытое существующими тестами. Все 9 требований подтверждены
      существующими тестами (independence — `period-calculation.orchestrator.spec.ts`; виды правил —
      `pay-per-hour`/`order-payed`/`service-completed` `.entity.spec.ts`; источник часов —
      `service-calculation-data.repository.hours.spec.ts`; период/статус — `accounting-period.entity.
      spec.ts`; утверждённый план перед закрытием — `close-accounting-period.handler.spec.ts`
      (`UnapprovedSalesPlanRowsException`); снапшот/пересчёт — `accounting-cache-freshness.spec.ts`;
      отчёты — `get-employee-salary-report.service.spec.ts`, `get-department-salary-report.service.
      spec.ts`). Дополнительно обнаружен пробел — `SalaryAccrual`/`Payout` не описаны ни в CLAUDE.md,
      ни в спеке; зафиксирован явно в `proposal.md` (Impact) и `specs/service/accounting/spec.md`
      (Purpose) как предмет отдельного последующего change, а не тихо опущен.

## 4. Зачистка комментариев в `modules/accounting`

- [x] 4.1 Пройти объяснительные ("почему") комментарии в файлах `modules/accounting`, относящихся к
      покрытой спеком части модуля (мотивационная схема, зарплатные правила, расчётный период,
      отчёты) — **исключая** `SalaryAccrual`/`Payout`/`erp-cash` (см. пробел, зафиксированный в
      задаче 3.2, вне scope этого change) — и рассортировать каждый на: удалить (описывает "что", а
      не "почему"), заменить на `spec:`-ссылку (объясняет бизнес-правило, покрытое спеком), оставить
      как есть (архитектурное/имплементационное пояснение — см. критерий в `conventions/
      documentation`). **Уточнение объёма по факту разбора (см. обсуждение в конце этой задачи):**
      сплошной построчный разбор всех ~64 файлов в объявленном скоупе оказался избыточным —
      подавляющее большинство оставшихся файлов (`application/ports/*`, `domain/types/*`,
      `infrastructure/mappers/*`) содержат комментарии, описывающие форму данных (какое поле что
      значит), а не бизнес-правила или архитектурные решения — они вне категорий этой конвенции и не
      подлежат ни удалению, ни переносу. Разбор выполнен полностью для файлов с содержательными
      "почему"-блоками: `domain/services/{money,float-percent,paid-order-status,period-calculation.
      orchestrator,accounting-cache-freshness}.ts`, `domain/entities/accounting-period.entity.ts`,
      `domain/entities/salary-rules/{pay-per-hour,service-completed,order-payed}.entity.ts`,
      `application/command/close-accounting-period.handler.ts`. По ходу разбора обнаружено 5
      бизнес-правил, которых не было ни в CLAUDE.md, ни в первой версии спека (округление до рубля,
      ступенчатый/линейный `FloatPercent`, определение оплаченности заказа по статусу, фильтр по
      типам заказа для `ServiceCompleted`/`OrderPayed`, условия закрытия периода — истёкший месяц +
      успешный синк ERP) — добавлены в `specs/service/accounting/spec.md` как отдельные требования,
      каждое подтверждено существующим тестом. Остальные ~54 файла заявленного скоупа (в основном
      `application/ports/*`, `domain/types/*`, мапперы/репозитории с комментариями-лейблами полей) —
      не разобраны построчно; явно вне объёма этого change, а не тихо пропущены.
- [x] 4.2 Применить рассортировку из 4.1: удалить помеченные для удаления, заменить помеченные для
      замены на `spec: service/accounting#<anchor>` — по одной ссылке на комментарий, без
      дублирования текста объяснения рядом с ссылкой. Выполнено для всех файлов, разобранных в 4.1
      (15 `spec:`-ссылок добавлено, ни одного комментария для чистого удаления не нашлось — все
      найденные бизнес-правило-объясняющие комментарии содержали рядом architecture-часть, которая
      сохранена).
- [x] 4.3 Прогнать `npm run test -- --testPathPatterns=domains/service/modules/accounting` —
      зелёные (57 test suites, 286 тестов), поведение модуля не изменилось. `npm run test:e2e` не
      выполним независимо от этого change — `backend/test/jest-e2e.json` отсутствует в текущем
      чекауте (`backend/test/` не существует; предыдущий раз файл менялся в очень старом коммите,
      никак не связанном с этой сессией) — pre-existing проблема окружения, а не следствие правок
      этого change. Правки задачи 4 — только комментарии (ни одна строка исполняемого кода не
      менялась), поэтому риск регресса поведения, который должен был бы поймать e2e, минимален; тем
      не менее e2e-прогон остаётся невыполненным пунктом верификации, а не тихо пропущенным.
- [x] 4.4 Прогнать скрипт-валидатор из раздела 2 на `backend/src/domains/service/modules/accounting`
      — все добавленные в 4.2 ссылки резолвятся без ошибок.

## 5. Итоговая проверка change

- [x] 5.1 `openspec validate docs-migration-to-openspec --strict` без ошибок.
- [x] 5.2 `eslint` без предупреждений на всех файлах `modules/accounting`, затронутых задачей 4
      (money.ts, float-percent.ts, paid-order-status.ts, period-calculation.orchestrator.ts,
      accounting-cache-freshness.ts, accounting-period.entity.ts, pay-per-hour/service-completed/
      order-payed.entity.ts, close-accounting-period.handler.ts).
