/**
 * Adding a `code` string with a custom status code for every
 * exception is a good practice, since when that exception
 * is transferred to another process `instanceof` check
 * cannot be performed anymore so a `code` string is used instead.
 * code constants can be stored in a separate file so they
 * can be shared and reused on a receiving side (code sharing is
 * useful when developing fullstack apps or microservices)
 */
export const ARGUMENT_INVALID = 'GENERIC.ARGUMENT_INVALID';
export const ARGUMENT_OUT_OF_RANGE = 'GENERIC.ARGUMENT_OUT_OF_RANGE';
export const ARGUMENT_NOT_PROVIDED = 'GENERIC.ARGUMENT_NOT_PROVIDED';
export const NOT_FOUND = 'GENERIC.NOT_FOUND';
export const CONFLICT = 'GENERIC.CONFLICT';
export const INTERNAL_SERVER_ERROR = 'GENERIC.INTERNAL_SERVER_ERROR';
export const SALARY_RULE_CREATION_ERROR = 'GENERIC.SALARY_RULE_CREATION_ERROR';
// src/modules/tasks (replace-bitrix-task-integration) — переход задачи в
// статус, не входящий в список допустимых для её текущего статуса
// (specs/tasks/spec.md, Requirement: «Жизненный цикл статуса задачи»).
export const INVALID_TASK_TRANSITION = 'GENERIC.INVALID_TASK_TRANSITION';
// src/modules/tasks (add-task-salary-rule-links-comments) — попытка
// сохранить комментарий/ссылку задачи с невалидным значением
// (spec: tasks/comments#requirement-пустой-комментарий-отклоняется,
// spec: tasks/links#requirement-ссылка-должна-быть-валидным-адресом).
export const TASK_COMMENT_BODY_EMPTY = 'TASKS.COMMENT_BODY_EMPTY';
export const INVALID_TASK_LINK_URL = 'TASKS.INVALID_LINK_URL';
// src/modules/tasks (edit-task) — попытка изменить поля задачи (title/
// description/deadline/assigneeEmployeeId), уже находящейся в терминальном
// статусе (CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY) — openspec/changes/
// edit-task/specs/tasks/spec.md, Requirement: «Редактирование полей активной
// задачи».
export const TASK_ALREADY_CLOSED = 'TASKS.ALREADY_CLOSED';
// domains/{service,shop}/modules/accounting (add-task-salary-rule-links-comments) —
// GetSalaryRuleService (боковая панель зарплатного правила,
// features/SalaryRuleDetailsPanel) не нашла правило по id. Общий код для
// обоих направлений — конечный клиент (фронтенд) различает direction
// параметром запроса, а не кодом ошибки.
export const SALARY_RULE_NOT_FOUND = 'ACCOUNTING.SALARY_RULE_NOT_FOUND';
