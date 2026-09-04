## 1. Проверка готовности спеков

- [x] 1.1 Убедиться, что `specs/service/sales/spec.md`, `specs/service/reports/spec.md`,
      `specs/service/marketing/spec.md`, `specs/service/roapp-sync/spec.md` присутствуют в дереве
      специй этого change и проходят `openspec validate service-domain-docs-migration-to-openspec
      --strict` без ошибок формата.
- [x] 1.2 Сверить каждое требование всех четырёх спеков с существующими unit/e2e-тестами модулей
      (список уже собран в разделе "Test Coverage Notes" каждого spec.md на этапе планирования) —
      подтвердить, что ссылки на тесты актуальны (файлы существуют, тесты зелёные), и что пробелы,
      отмеченные как "не покрыто тестами", по-прежнему актуальны, а не закрыты с момента написания
      спека.

## 2. `service/sales` — CLAUDE.md, зачистка комментариев, проверка

- [x] 2.1 Заменить раздел `### \`modules/sales\`` в `backend/src/domains/service/CLAUDE.md` на
      краткое описание модуля и указатель на `openspec/specs/service/sales/spec.md` для бизнес-правил
      (архитектурные детали — имена классов, DI, структура файлов — остаются в CLAUDE.md).
- [x] 2.2 Пройти объяснительные ("почему") комментарии, объясняющие бизнес-правила, покрытые спеком
      `service/sales`, в файлах: `domain/entities/sales-plan.entity.ts`,
      `domain/entities/sales-plan-template.entity.ts`, `domain/services/order-sales-plans.ts`,
      `domain/services/funnel-kpi.calculator.ts`, `domain/value-objects/funnel-stage-map.value-
      object.ts`, `application/services/ensure-sales-plans-for-period.service.ts`,
      `application/services/get-sales-performance.service.ts` — заменить на `spec: service/sales#
      <anchor>` там, где комментарий объясняет бизнес-правило (не архитектуру/реализацию), удалить
      чисто описательные, оставить архитектурные пояснения как есть.
- [x] 2.3 Прогнать `npm run test -- --testPathPatterns=domains/service/modules/sales` — убедиться,
      что зачистка комментариев не задела код (тесты остаются зелёными).
- [x] 2.4 Прогнать валидатор `spec:`-ссылок (`openspec/scripts/validate-spec-refs.mjs`) на
      `backend/src/domains/service/modules/sales` — все добавленные ссылки резолвятся без ошибок.

## 3. `service/reports` — CLAUDE.md, зачистка комментариев, проверка

- [x] 3.1 Добавить в `backend/src/domains/service/CLAUDE.md` короткий раздел `### \`modules/
      reports\`` (сейчас модуль упомянут одной строкой без отдельного раздела) с указателем на
      `openspec/specs/service/reports/spec.md` для бизнес-правил.
- [x] 3.2 Пройти объяснительные комментарии, объясняющие бизнес-правила, покрытые спеком
      `service/reports`, в первую очередь `domain/services/service-metrics.calculator.ts`,
      `domain/services/period-breakdown.calculator.ts`, `domain/value-objects/period-bucket.value-
      object.ts` — заменить на `spec: service/reports#<anchor>` по тому же критерию, что и в разделе 2.
- [x] 3.3 Зафиксировать (не исправлять в рамках этого change) обнаруженное на этапе документирования
      расхождение: тестовая заглушка порта источника данных в
      `interface/http-controllers/reports.e2e.spec.ts` не реализует метод получения справочника
      типов заказов, что не ловится текущим `npm run test`, но всплывает при `tsc --noEmit` — завести
      как отдельно отслеживаемую задачу вне scope документационной миграции (issue/заметка в
      `domains/service/CLAUDE.md` или трекере задач проекта, на усмотрение владельца модуля).
- [x] 3.4 Прогнать `npm run test -- --testPathPatterns=domains/service/modules/reports` — тесты
      остаются зелёными после зачистки комментариев.
- [x] 3.5 Прогнать валидатор `spec:`-ссылок на `backend/src/domains/service/modules/reports` — все
      добавленные ссылки резолвятся без ошибок.

## 4. `service/marketing` — CLAUDE.md, зачистка комментариев, проверка

- [x] 4.1 Добавить в `backend/src/domains/service/CLAUDE.md` короткий раздел `### \`modules/
      marketing/pricing\`` (сейчас упомянут одной строкой) с указателем на
      `openspec/specs/service/marketing/spec.md` для бизнес-правил.
- [x] 4.2 Пройти объяснительные комментарии, объясняющие бизнес-правила, покрытые спеком
      `service/marketing`, в `domain/value-objects/service-price-change.value-object.ts` и
      `application/command/update-service-prices.handler.ts` — заменить на
      `spec: service/marketing#<anchor>` по тому же критерию.
- [x] 4.3 Прогнать `npm run test -- --testPathPatterns=domains/service/modules/marketing` — тесты
      остаются зелёными.
- [x] 4.4 Прогнать валидатор `spec:`-ссылок на `backend/src/domains/service/modules/marketing` — все
      добавленные ссылки резолвятся без ошибок.

## 5. `service/roapp-sync` — CLAUDE.md, зачистка комментариев, проверка

- [x] 5.1 Заменить раздел `### \`sync/roapp\` — синхронизация с ERP` в
      `backend/src/domains/service/CLAUDE.md` на краткое описание и указатель на
      `openspec/specs/service/roapp-sync/spec.md` для бизнес-правил (порядок операций, курсор
      докатки, формула KPI); архитектурные детали (имена классов, cron-декоратор, DI) остаются в
      CLAUDE.md.
- [x] 5.2 Пройти объяснительные комментарии, объясняющие бизнес-правила, покрытые спеком
      `service/roapp-sync`, в `roapp-sync.service.ts` (топологическая сортировка категорий,
      `calculateOrderKPIs`, порядок заказы→позиции, задержка между заказами) и `roapp-sync.cron.ts`
      (механизм `failedSince`) — заменить на `spec: service/roapp-sync#<anchor>` по тому же критерию.
- [x] 5.3 Прогнать `npm run test -- --testPathPatterns=domains/service/sync/roapp` — тесты остаются
      зелёными после зачистки комментариев.
- [x] 5.4 Прогнать валидатор `spec:`-ссылок на `backend/src/domains/service/sync/roapp` — все
      добавленные ссылки резолвятся без ошибок.

## 6. Итоговая проверка change

- [x] 6.1 `openspec validate service-domain-docs-migration-to-openspec --strict` без ошибок.
- [x] 6.2 `eslint` без предупреждений на всех файлах, затронутых разделами 2–5 (список файлов —
      объединение файлов из задач 2.2, 3.2, 4.2, 5.2).
- [x] 6.3 Полный прогон `npm run test -- --testPathPatterns=domains/service/modules/(sales|reports|
      marketing)` и `--testPathPatterns=domains/service/sync/roapp` одним финальным прогоном —
      убедиться, что ни одна из четырёх зачисток не повлияла на смежные модули (в частности,
      `modules/accounting`, зависящий от `sales` через `SALES_PLAN_REPOSITORY`).
