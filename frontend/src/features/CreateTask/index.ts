/**
 * Публичный API фичи (frontend/CLAUDE.md, "Публичный API модуля через index.ts").
 *
 * `CreateTaskForm` — корневой UI-компонент (заголовок/описание/дедлайн/ответственный →
 * `POST /v1/tasks`), используется на общей странице `/tasks` (раздел 13 tasks.md, через
 * `CreateTaskModal`) и как тело `CreateTaskPanel` — side-panel-обёртка (`SidePanel`,
 * `shared/ui-kit`), которую использует `features/SalaryRuleForm`'s task-linking flow при
 * создании задачи для правила `TaskCompletion` (`pages/SalaryRuleDetail`/`pages/SalaryRules`).
 *
 * `useCreateTask` экспортирован тоже — отклонение от "только корневой компонент", по прецеденту
 * `features/TargetDirectory/index.ts`.
 */
export { CreateTaskForm } from './ui/CreateTaskForm.tsx'
export type { CreateTaskFormProps } from './ui/CreateTaskForm.tsx'
export { CreateTaskPanel } from './ui/CreateTaskPanel.tsx'
export type { CreateTaskPanelProps } from './ui/CreateTaskPanel.tsx'
export { useCreateTask } from './model/useCreateTask.ts'
