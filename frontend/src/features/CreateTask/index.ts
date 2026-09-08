/**
 * Публичный API фичи (frontend/CLAUDE.md, "Публичный API модуля через index.ts").
 *
 * `CreateTaskForm` — корневой UI-компонент (заголовок/описание/дедлайн/ответственный →
 * `POST /v1/tasks`), используется на общей странице `/tasks` (раздел 13 tasks.md) и как Шаг 1
 * мастера создания правила `TaskCompletion` (`pages/SalaryRuleDetail`, раздел 14 tasks.md).
 *
 * `useCreateTask` экспортирован тоже — отклонение от "только корневой компонент", по прецеденту
 * `features/TargetDirectory/index.ts`: мастер создания правила (`useCreateTaskCompletionRuleWizard`,
 * `architecture.md`) композирует эту мутацию напрямую (не через готовую форму), чтобы управлять
 * шагом самостоятельно.
 */
export { CreateTaskForm } from './ui/CreateTaskForm.tsx'
export type { CreateTaskFormProps } from './ui/CreateTaskForm.tsx'
export { useCreateTask } from './model/useCreateTask.ts'
