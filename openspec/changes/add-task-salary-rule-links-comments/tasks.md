## 1. Backend — Prisma-схема: `TaskComment`, `TaskLink`

- [x] 1.1 Добавить в `backend/prisma/schema/task.prisma` (или соседний файл модуля `tasks`) модели
  `TaskComment` (`id, taskId, authorEmployeeId, body, createdAt`, индекс по `taskId`) и `TaskLink`
  (`id, taskId, url, label?, createdAt`, индекс по `taskId`) — без `@relation` на `Task`/`BitrixEmployee`,
  по прецеденту `assigneeEmployeeId`; сгенерировать миграцию и Prisma Client. Чисто схемное изменение
  без бизнес-логики — тестов не требует; проверка: `npx prisma migrate dev` создаёт таблицы
  `task_comments`/`task_links`, `npx prisma generate` проходит без ошибок, типы `TaskComment`/`TaskLink`
  доступны из `@prisma/client`.

## 2. Backend — `TaskCommentBody` (value object, TDD)

- [x] 2.1 Написать тесты: конструктор `TaskCommentBody` принимает непустой текст; выбрасывает
  `TaskCommentBodyEmptyException` на пустую строку и на строку из одних пробелов (`spec:
  tasks/comments#Requirement: Пустой комментарий отклоняется`) — убедиться, что тест-раннер их видит
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red (класса `TaskCommentBody` ещё нет)
- [x] 2.3 Реализовать `TaskCommentBody extends ValueObject<string>` в `modules/tasks/domain/value-objects/`
- [x] 2.4 Прогнать тесты из 2.1, зафиксировать green, убедиться, что соседние тесты `modules/tasks` не сломались

## 3. Backend — `TaskLinkUrl` (value object, TDD)

- [x] 3.1 Написать тесты: конструктор `TaskLinkUrl` принимает синтаксически валидный URL; выбрасывает
  `InvalidTaskLinkUrlException` на невалидное значение (`spec: tasks/links#Requirement: Ссылка должна
  быть валидным адресом`) — убедиться, что тест-раннер их видит
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать red
- [x] 3.3 Реализовать `TaskLinkUrl extends ValueObject<string>` в `modules/tasks/domain/value-objects/`
- [x] 3.4 Прогнать тесты из 3.1, зафиксировать green, регрессий нет

## 4. Backend — сущность `TaskComment` (TDD)

- [x] 4.1 Написать тесты: `TaskComment.create({taskId, authorEmployeeId, text})` создаёт сущность с
  `TaskCommentBody`, `createdAt`; `reconstitute` восстанавливает из персистентности; `validate()`
  бросает при пустом `taskId`/`authorEmployeeId` — убедиться, что тест-раннер их видит
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать red
- [x] 4.3 Реализовать `TaskComment extends Entity<TaskCommentProps>` в
  `modules/tasks/domain/entities/task-comment.entity.ts`
- [x] 4.4 Прогнать тесты из 4.1, зафиксировать green, регрессий нет

## 5. Backend — сущность `TaskLink` (TDD)

- [x] 5.1 Написать тесты: `TaskLink.create({taskId, url, label?})` создаёт сущность с `TaskLinkUrl`;
  `reconstitute`; `validate()` — убедиться, что тест-раннер их видит
- [x] 5.2 Прогнать тесты из 5.1 и зафиксировать red
- [x] 5.3 Реализовать `TaskLink extends Entity<TaskLinkProps>` в
  `modules/tasks/domain/entities/task-link.entity.ts`
- [x] 5.4 Прогнать тесты из 5.1, зафиксировать green, регрессий нет

## 6. Backend — `TaskCommentRepository` (Prisma, TDD)

- [x] 6.1 Написать интеграционные тесты репозитория: `insert` сохраняет комментарий; `findByTaskId`
  возвращает комментарии задачи по возрастанию `createdAt`, пустой массив для задачи без комментариев
  — убедиться, что тест-раннер их видит
- [x] 6.2 Прогнать тесты из 6.1 и зафиксировать red (реализации ещё нет)
- [x] 6.3 Реализовать `TaskCommentRepositoryPort` (`insert`, `findByTaskId`) и `TaskCommentRepository`
  (Prisma-мэппер domain ↔ persistence) в `modules/tasks/application/ports/` и `infrastructure/repositories/`
- [x] 6.4 Прогнать тесты из 6.1, зафиксировать green, регрессий в `modules/tasks` нет

## 7. Backend — `TaskLinkRepository` (Prisma, TDD)

- [x] 7.1 Написать интеграционные тесты: `insert` сохраняет ссылку; `findByTaskId` возвращает все ссылки
  задачи; `delete` удаляет по id и не затрагивает чужие ссылки — убедиться, что тест-раннер их видит
- [x] 7.2 Прогнать тесты из 7.1 и зафиксировать red
- [x] 7.3 Реализовать `TaskLinkRepositoryPort` (`insert`, `findByTaskId`, `delete`) и `TaskLinkRepository`
- [x] 7.4 Прогнать тесты из 7.1, зафиксировать green, регрессий нет

## 8. Backend — `AddTaskCommentService` (CQRS command, TDD)

- [x] 8.1 Написать тесты: команда с непустым текстом создаёт и сохраняет `TaskComment` с автором из
  переданного `authorEmployeeId`; с пустым/пробельным текстом — отклоняется до записи в репозиторий
  (`spec: tasks/comments#Requirement: Пустой комментарий отклоняется`) — убедиться, что тест-раннер их видит
- [x] 8.2 Прогнать тесты из 8.1 и зафиксировать red
- [x] 8.3 Реализовать `AddTaskCommentCommand`/`AddTaskCommentHandler` в `modules/tasks/application/command/`
- [x] 8.4 Прогнать тесты из 8.1, зафиксировать green, регрессий нет

## 9. Backend — `ListTaskCommentsService` (query, TDD)

- [x] 9.1 Написать тесты: сервис отдаёт комментарии задачи в хронологическом порядке; пустой список для
  задачи без комментариев (`spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и
  текст`) — убедиться, что тест-раннер их видит
- [x] 9.2 Прогнать тесты из 9.1 и зафиксировать red
- [x] 9.3 Реализовать `ListTaskCommentsService` в `modules/tasks/application/services/`
- [x] 9.4 Прогнать тесты из 9.1, зафиксировать green, регрессий нет

## 10. Backend — `AddTaskLinkService` (CQRS command, TDD)

- [x] 10.1 Написать тесты: команда с валидным URL создаёт и сохраняет `TaskLink`; с невалидным URL —
  отклоняется до записи (`spec: tasks/links#Requirement: Ссылка должна быть валидным адресом`);
  повторное добавление ссылки к задаче с уже существующими не теряет прежние (`spec: tasks/links#Requirement:
  Задача может иметь несколько ссылок`) — убедиться, что тест-раннер их видит
- [x] 10.2 Прогнать тесты из 10.1 и зафиксировать red
- [x] 10.3 Реализовать `AddTaskLinkCommand`/`AddTaskLinkHandler`
- [x] 10.4 Прогнать тесты из 10.1, зафиксировать green, регрессий нет

## 11. Backend — `RemoveTaskLinkService` (CQRS command, TDD)

- [x] 11.1 Написать тесты: удаление существующей ссылки убирает её из `findByTaskId`, остальные ссылки
  задачи не затрагиваются (`spec: tasks/links#Requirement: Ссылка удаляется из карточки задачи`) —
  убедиться, что тест-раннер их видит
- [x] 11.2 Прогнать тесты из 11.1 и зафиксировать red
- [x] 11.3 Реализовать `RemoveTaskLinkCommand`/`RemoveTaskLinkHandler`
- [x] 11.4 Прогнать тесты из 11.1, зафиксировать green, регрессий нет

## 12. Backend — `ListTaskLinksService` (query, TDD)

- [x] 12.1 Написать тесты: сервис отдаёт все ссылки задачи; пустой список для задачи без ссылок —
  убедиться, что тест-раннер их видит
- [x] 12.2 Прогнать тесты из 12.1 и зафиксировать red
- [x] 12.3 Реализовать `ListTaskLinksService`
- [x] 12.4 Прогнать тесты из 12.1, зафиксировать green, регрессий нет

## 13. Backend — HTTP: комментарии задачи (TDD)

- [x] 13.1 Написать e2e/controller-тесты: `GET /v1/tasks/:id/comments` отдаёт список; `POST
  /v1/tasks/:id/comments` с непустым текстом создаёт комментарий, автор берётся из
  `req.user.employeeId` (`SessionAuthGuard`), а не из тела запроса; с пустым текстом — 4xx — убедиться,
  что тест-раннер их видит
- [x] 13.2 Прогнать тесты из 13.1 и зафиксировать red
- [x] 13.3 Реализовать `ListTaskCommentsHttpController`, `CreateTaskCommentHttpController` (nestjs-zod
  DTO, `@ApiTags('Задачи: комментарии')`, `@ApiOperation` на каждом методе)
- [x] 13.4 Прогнать тесты из 13.1, зафиксировать green, регрессий в `modules/tasks` нет

## 14. Backend — HTTP: ссылки задачи (TDD)

- [x] 14.1 Написать e2e/controller-тесты: `GET /v1/tasks/:id/links`, `POST /v1/tasks/:id/links` (валидный
  URL → 201, невалидный → 4xx), `DELETE /v1/tasks/:id/links/:linkId` (удаляет, чужой/несуществующий
  `linkId` → 404) — убедиться, что тест-раннер их видит
- [x] 14.2 Прогнать тесты из 14.1 и зафиксировать red
- [x] 14.3 Реализовать `ListTaskLinksHttpController`, `CreateTaskLinkHttpController`,
  `DeleteTaskLinkHttpController` (nestjs-zod DTO, `@ApiTags('Задачи: ссылки')`, `@ApiOperation`)
- [x] 14.4 Прогнать тесты из 14.1, зафиксировать green, регрессий нет

## 15. Backend — `SalaryRuleRepositoryPort.findByTaskId` (service + shop, TDD)

- [x] 15.1 Написать тесты для обоих доменов (`domains/service/modules/accounting`,
  `domains/shop/modules/accounting`): правило текущего периода находится по `taskId` из
  `props.config.taskIdByPeriod`; для задачи без ссылающегося правила — `null` (`spec: service/accounting#
  Requirement: Зарплатное правило и начисление доступны для поиска по идентификатору задачи`, `spec:
  shop/accounting#Requirement: Зарплатное правило и начисление доступны для поиска по идентификатору
  задачи`) — убедиться, что тест-раннер их видит
- [x] 15.2 Прогнать тесты из 15.1 и зафиксировать red в обоих доменах
- [x] 15.3 Добавить метод `findByTaskId` в `SalaryRuleRepositoryPort` и реализовать его в
  `SalaryRuleRepository` каждого домена (фильтр `type='TaskCompletion'`, `direction` зашит в репозитории,
  как у существующих методов порта)
- [x] 15.4 Прогнать тесты из 15.1 в обоих доменах, зафиксировать green, регрессий в `accounting` нет

## 16. Backend — `SalaryAccrualRepositoryPort.findLineByTaskId` (service + shop, TDD)

- [x] 16.1 Написать тесты для обоих доменов: строка начисления находится по `taskId` через `sources:
  [{type:'taskCompletion', id: taskId}]`; для задачи без отображаемого начисления — `null` (`spec:
  service/accounting#Requirement: Зарплатное правило и начисление доступны для поиска по идентификатору
  задачи`, `spec: shop/accounting#Requirement: Зарплатное правило и начисление доступны для поиска по
  идентификатору задачи`) — убедиться, что тест-раннер их видит
- [x] 16.2 Прогнать тесты из 16.1 и зафиксировать red
- [x] 16.3 Добавить метод `findLineByTaskId(direction, taskId)` в `SalaryAccrualRepositoryPort` и
  реализовать его в `SalaryAccrualRepository` каждого домена
- [x] 16.4 Прогнать тесты из 16.1, зафиксировать green, регрессий нет

## 17. Backend — `FindSalaryRuleForTaskService` + `FindSalaryAccrualForTaskService` (service + shop, TDD)

- [x] 17.1 Написать тесты для обоих доменов: сервисы маппят найденные `SalaryRule`/`SalaryAccrualLine`
  в `SalaryRuleSummary`/`SalaryAccrualLineSummary` (сумма + статус строки, `spec: service/accounting#
  Requirement: Зарплатное правило и начисление доступны для поиска по идентификатору задачи`) —
  убедиться, что тест-раннер их видит
- [x] 17.2 Прогнать тесты из 17.1 и зафиксировать red
- [x] 17.3 Реализовать `FindSalaryRuleForTaskService`, `FindSalaryAccrualForTaskService` в каждом домене
- [x] 17.4 Прогнать тесты из 17.1, зафиксировать green, регрессий нет

## 18. Backend — `GetSalaryRuleService` (service + shop, TDD)

- [x] 18.1 Написать тесты: сервис возвращает `SalaryRuleDetail` (название, вид, роль, направление,
  параметры, название мотивационной схемы) для существующего `ruleId`; бросает
  `SalaryRuleNotFoundException` для несуществующего — убедиться, что тест-раннер их видит
- [x] 18.2 Прогнать тесты из 18.1 и зафиксировать red
- [x] 18.3 Реализовать `GetSalaryRuleService` поверх уже существующего `SalaryRuleRepositoryPort.findById`
  в каждом домене (добавить получение названия мотивационной схемы — по `motivationSchemaId`)
- [x] 18.4 Прогнать тесты из 18.1, зафиксировать green, регрессий нет

## 19. Backend — HTTP: зарплатное правило по id / по taskId / начисление по taskId (service + shop, TDD)

- [x] 19.1 Написать e2e/controller-тесты для обоих доменов: `GET
  /v1/{service,shop}/accounting/salary-rules/:ruleId` (200/404), `GET
  /v1/{service,shop}/accounting/salary-rules/by-task/:taskId` (200/null), `GET
  /v1/{service,shop}/accounting/salary-accrual-lines/by-task/:taskId` (200/null) — убедиться, что
  тест-раннер их видит
- [x] 19.2 Прогнать тесты из 19.1 и зафиксировать red
- [x] 19.3 Реализовать `GetSalaryRuleHttpController`, `GetSalaryRuleByTaskHttpController`,
  `GetSalaryAccrualLineByTaskHttpController` в каждом домене (`@ApiTags`, `@ApiOperation`, DTO из
  `ireports-contracts`)
- [x] 19.4 Прогнать тесты из 19.1, зафиксировать green, регрессий в `accounting` обоих доменов нет

## 20. Contracts — Zod-схемы

- [x] 20.1 Написать тесты: схемы `TaskComment`, `TaskLink` (принимает валидный URL, отклоняет
  невалидный), `SalaryRuleSummary`, `SalaryAccrualLineSummary`, `SalaryRuleDetail` парсят валидные
  данные и отклоняют некорректные (пустые обязательные поля, невалидный URL) — убедиться, что
  тест-раннер их видит
- [x] 20.2 Прогнать тесты из 20.1 и зафиксировать red
- [x] 20.3 Добавить схемы и выведенные типы в `contracts/` (`ireports-contracts`), экспортировать
- [x] 20.4 Прогнать тесты из 20.1, зафиксировать green; убедиться, что backend/frontend собираются с
  новыми типами без ошибок компиляции

## 21. Frontend — `features/TaskStatusControl/model/api.ts`: `commentsApi`, `linksApi`, `salaryReferenceApi` (TDD)

- [x] 21.1 Написать тесты: `commentsApi.list/create`, `linksApi.list/create/remove`,
  `salaryReferenceApi.getRule/getAccrual` возвращают `queryOptions`/промисы с ожидаемыми `queryKey`;
  сетевые ошибки оборачиваются в `ApiError` с читаемым сообщением на русском — убедиться, что
  тест-раннер их видит
- [x] 21.2 Прогнать тесты из 21.1 и зафиксировать red
- [x] 21.3 Реализовать методы в `model/api.ts` (аналогично уже существующему `tasksApi`)
- [x] 21.4 Прогнать тесты из 21.1, зафиксировать green, регрессий в `TaskStatusControl` нет

## 22. Frontend — `useTaskComments` (TDD)

- [x] 22.1 Написать тесты хука: возвращает список комментариев, `addComment` добавляет новый и
  инвалидирует список, ошибка пустого текста не уходит в API (`spec: tasks/comments#Requirement:
  Пустой комментарий отклоняется`) — убедиться, что тест-раннер их видит
- [x] 22.2 Прогнать тесты из 22.1 и зафиксировать red
- [x] 22.3 Реализовать `useTaskComments(taskId)` в `features/TaskStatusControl/model/`
- [x] 22.4 Прогнать тесты из 22.1, зафиксировать green, регрессий нет

## 23. Frontend — `useTaskLinks` (TDD)

- [x] 23.1 Написать тесты хука: возвращает список ссылок, `addLink` отклоняет невалидный URL до
  отправки (`spec: tasks/links#Requirement: Ссылка должна быть валидным адресом`), `removeLink` убирает
  ссылку из списка — убедиться, что тест-раннер их видит
- [x] 23.2 Прогнать тесты из 23.1 и зафиксировать red
- [x] 23.3 Реализовать `useTaskLinks(taskId)`
- [x] 23.4 Прогнать тесты из 23.1, зафиксировать green, регрессий нет

## 24. Frontend — `useTaskSalaryReference` (TDD)

- [x] 24.1 Написать тесты хука: при заполненном `task.direction` запрашивает только этот домен; при
  пустом `direction` — последовательно `service`, затем `shop`, использует первый непустой результат
  (design.md, решение 3); при отсутствии связанного правила — блок скрыт (`rule: null`) — убедиться, что
  тест-раннер их видит
- [x] 24.2 Прогнать тесты из 24.1 и зафиксировать red
- [x] 24.3 Реализовать `useTaskSalaryReference(task)`
- [x] 24.4 Прогнать тесты из 24.1, зафиксировать green, регрессий нет

## 25. Frontend — `TaskLinksSection`, `TaskCommentsSection` (UI, TDD)

- [x] 25.1 Написать тесты компонентов по фреймам `yZE5X` (заполненные списки), `r86qEK` (пустые
  состояния — `Inline Note`), `cW0k5` (ошибка невалидного URL у `Link Row`, ошибка пустого комментария
  и неактивная кнопка «Отправить») — прочитать точную структуру через `mcp__pencil__execute`/`Get` по
  этим node id, не угадывать вёрстку; проверить рендер списка/пустого состояния/ошибок и вызовы
  `onAddLink`/`onRemoveLink`/`onAddComment` — убедиться, что тест-раннер их видит
- [x] 25.2 Прогнать тесты из 25.1 и зафиксировать red
- [x] 25.3 Реализовать `TaskLinksSection`, `TaskCommentsSection` в `features/TaskStatusControl/ui/`,
  используя UI Kit `ref`-компоненты `ERP/Molecule/Link Row` (`baDJe`), `ERP/Molecule/Comment Item`
  (`XSPm8`), `ERP/Molecule/Inline Note` (`F7ai0`), `ERP/Atom/Input` (`tNjjM`), `ERP/Atom/Textarea`
  (`DcWkE`), `ERP/Atom/Button` (`AP9Nr`)
- [x] 25.4 Прогнать тесты из 25.1, зафиксировать green, регрессий нет

## 26. Frontend — `SalaryRuleSummaryBlock` (UI, TDD)

- [x] 26.1 Написать тесты компонента по фреймам `yZE5X` (правило + видимая строка начисления с суммой и
  статусом), `r86qEK` (правило без начисления — строка начисления и разделитель скрыты целиком),
  `cW0k5` (правило отсутствует — блок не рендерится вовсе) — прочитать структуру через
  `mcp__pencil__execute`/`Get`; проверить клик по блоку вызывает `onOpen` с `{ruleId, direction}` —
  убедиться, что тест-раннер их видит
- [x] 26.2 Прогнать тесты из 26.1 и зафиксировать red
- [x] 26.3 Реализовать `SalaryRuleSummaryBlock` в `features/TaskStatusControl/ui/`, сохранив как reusable
  внутри `uDEum` компонент `ERP/Organism/Task Rule Card` (`QmF9j`) как есть (уже создан на этапе
  ui-design), использовать его как `ref`
- [x] 26.4 Прогнать тесты из 26.1, зафиксировать green, регрессий нет

## 27. Frontend — интеграция блоков в `TaskStatusCard`/`TaskDetailsPanel` (TDD)

- [x] 27.1 Написать тесты: `TaskDetailsPanel` принимает новый опциональный проп `onOpenSalaryRule?`;
  без него блок правила отображается некликабельным; с ним — клик вызывает колбэк; блоки
  ссылок/комментариев рендерятся под существующим содержимым карточки (`spec: tasks/salary-rule-panel#
  Requirement: Клик по связанному правилу открывает боковую панель с его описанием`) — убедиться, что
  тест-раннер их видит
- [x] 27.2 Прогнать тесты из 27.1 и зафиксировать red
- [x] 27.3 Обновить `TaskStatusControl.tsx`/`TaskStatusCard.tsx`: подключить `useTaskComments`,
  `useTaskLinks`, `useTaskSalaryReference`, отрендерить `SalaryRuleSummaryBlock`, `TaskLinksSection`,
  `TaskCommentsSection`, прокинуть `onOpenSalaryRule` в `TaskDetailsPanel`
- [x] 27.4 Прогнать тесты из 27.1, зафиксировать green, регрессий в существующих сценариях
  `TaskStatusControl` (статус, переходы) нет

## 28. Frontend — `features/SalaryRuleDetailsPanel`: `useSalaryRule` + `api.ts` (TDD)

- [x] 28.1 Написать тесты: `useSalaryRule(ruleId, direction)` запрашивает `GET
  /v1/{direction}/accounting/salary-rules/:ruleId`, возвращает `{rule, isLoading, error}`; ошибка API
  оборачивается в `ApiError` — убедиться, что тест-раннер их видит
- [x] 28.2 Прогнать тесты из 28.1 и зафиксировать red
- [x] 28.3 Реализовать `model/api.ts` (`salaryRuleApi.get`) и `useSalaryRule` в новой фиче
  `features/SalaryRuleDetailsPanel/`
- [x] 28.4 Прогнать тесты из 28.1, зафиксировать green

## 29. Frontend — `features/SalaryRuleDetailsPanel`: UI (TDD)

- [x] 29.1 Написать тесты компонента `SalaryRuleDetailsPanel`/`SalaryRuleSummaryCard` по фреймам `XiJo6`
  (десктоп) и `Nuezn` (мобильный) — прочитать структуру через `mcp__pencil__execute`/`Get`; проверить
  состояние загрузки, отображение полей (вид, роль, направление, схема начисления, параметры), плашку
  «только для просмотра», отсутствие кнопок редактирования, кнопку «Закрыть» — убедиться, что
  тест-раннер их видит
- [x] 29.2 Прогнать тесты из 29.1 и зафиксировать red
- [x] 29.3 Реализовать `ui/SalaryRuleDetailsPanel.tsx` (обёртка над `shared/ui-kit/organisms/SidePanel`)
  и `ui/SalaryRuleSummaryCard.tsx`, используя `ERP/Molecule/Spec Row` (`Q4IX0`), `ERP/Molecule/Inline
  Note` (`F7ai0`), `ERP/Atom/Badge` (`PGyPp`), `ERP/Atom/Chip` (`sVWu5`) как `ref`; экспортировать
  `SalaryRuleDetailsPanel` через `index.ts`
- [x] 29.4 Прогнать тесты из 29.1, зафиксировать green, регрессий нет

## 30. Frontend — `pages/Tasks`: `useSalaryRulePanel` + mediator (TDD)

- [x] 30.1 Написать тесты: `useSalaryRulePanel()` открывает/закрывает панель по `{ruleId, direction}`,
  без побочных запросов (по образцу `useTaskLinkPanels`); mediator-компонент композирует
  `useTasksPage()` + `useSalaryRulePanel()`, рендерит `TaskDetailsPanel` с `onOpenSalaryRule={openRule}`
  и `SalaryRuleDetailsPanel` с текущим `openRuleRef` — убедиться, что тест-раннер их видит
- [x] 30.2 Прогнать тесты из 30.1 и зафиксировать red
- [x] 30.3 Реализовать `useSalaryRulePanel` в `pages/Tasks/model/` и выделить `mediator/TasksPageMediator`
  (композиция без собственной бизнес-логики, без условного рендера — ветвления в презентационных
  компонентах)
- [x] 30.4 Прогнать тесты из 30.1, зафиксировать green, регрессий в `pages/Tasks` (список, фильтры,
  существующая карточка задачи) нет

## 31. Frontend — мобильный bottom-sheet карточки задачи (визуальная адаптация)

- [x] 31.1 Свести адаптивную раскладку блоков правила/ссылок/комментариев на 390 px по фрейму `V5n7hp`
  (`mcp__pencil__execute`/`Get`) — используется уже существующий адаптивный `SidePanel` (десктоп-панель
  / мобильный bottom-sheet), блоки переиспользуют компоненты из групп 25–26 без новой логики ветвления
  — тесты не заводятся (чисто адаптивная вёрстка поверх уже протестированных компонентов), проверка:
  скриншот на 390 px совпадает с `V5n7hp` (без overflow/clipping)

## 32. Финальная проверка

- [x] 32.1 Прогнать полный backend test suite (`modules/tasks`, `domains/service/modules/accounting`,
  `domains/shop/modules/accounting`, `contracts`) и убедиться в отсутствии регрессий
- [x] 32.2 Прогнать полный frontend test suite, типизацию (`tsc`) и линт для затронутых
  features/pages и убедиться в отсутствии регрессий
- [ ] 32.3 Вручную пройти основные сценарии в браузере: задача с правилом+начислением, задача с
  правилом без начисления, задача без правила, добавление/удаление ссылки (включая невалидный URL),
  добавление комментария (включая пустой), открытие и закрытие панели правила — как на десктопе, так и
  на мобильной ширине
